# [RSC-IRAN] Restricted project-user mode: server-side enforcement.
"""Restricted project-user mode: server-side enforcement.

One place decides. ``get_current_user_payload`` (every authenticated route
goes through it) loads the user row once, calls :func:`is_restricted_user`
and then :func:`enforce_restricted_access`. Deny by default: a restricted
user may only call the (method, path) pairs in ``_ALLOWED`` below. Per-object
checks (project membership & capabilities) stay in each handler via
``verify_project_access`` and ``require_project_cap``.
No extra DB query: the flag is read from the user row auth already loaded.
"""

from __future__ import annotations

import os
import re
from typing import Any

from fastapi import HTTPException, status

API_PREFIX = "/api/v1/"
_ID = r"[0-9a-fA-F-]{32,36}"
_R = frozenset({"GET", "HEAD"})
_ANY = None  # any method


def _rule(methods: frozenset[str] | None, pattern: str) -> tuple[frozenset[str] | None, re.Pattern[str]]:
    return methods, re.compile(pattern)


# Paths are relative to /api/v1/, trailing slash optional.
# Trimmed to the four shell areas: projects read/update, members read/manage,
# tasks, documents and photos, team_chat, search, users/me, avatars, notifications.
_ALLOWED: tuple[tuple[frozenset[str] | None, re.Pattern[str]], ...] = (
    # auth + own profile / avatar / own password / project caps
    _rule(_ANY, r"^users/auth(/.*)?$"),
    _rule(_ANY, r"^users/me(/.*)?$"),
    # Admin/manager-issued password-reset link; RequireRole("manager") still gates it.
    _rule(frozenset({"POST"}), rf"^users/{_ID}/reset-link/?$"),
    # other users' profile pictures (avatar image only; no user list, no edit)
    _rule(_R, rf"^users/{_ID}/avatar/?$"),
    # projects: read and update (list is membership-limited in the handler)
    _rule(_R, r"^projects/?$"),
    # dashboard cards: handler returns only projects the caller owns or is a member of
    _rule(_R, r"^projects/dashboard/cards/?$"),
    _rule(_R, rf"^projects/{_ID}/?$"),
    _rule(frozenset({"PATCH"}), rf"^projects/{_ID}/?$"),
    _rule(_R, rf"^projects/{_ID}/members/?$"),
    # project managers add / bulk-add / remove members.
    _rule(_R, rf"^projects/{_ID}/member-candidates/?$"),
    _rule(frozenset({"POST"}), rf"^projects/{_ID}/members(/bulk)?/?$"),
    _rule(frozenset({"DELETE"}), rf"^projects/{_ID}/members/{_ID}/?$"),
    # project file manager (documents + photos list, tree, storage locations). Read only.
    _rule(_R, rf"^projects/{_ID}/files(/(tree|locations))?/?$"),
    # correspondence: read only. Every GET handler enforces verify_project_access
    # except the shared general project (MZ-GENERAL), which all staff may read.
    _rule(_R, r"^correspondence(/.*)?$"),
    # letters (mailbox): compose, reply, forward, archive, read mark, labels, attachments.
    # Access is limited per letter by the mailbox helpers (sender, recipients, admin).
    _rule(frozenset({"POST"}), r"^correspondence/compose/?$"),
    _rule(frozenset({"POST"}), rf"^correspondence/{_ID}/(read|reply|forward|archive|unarchive|attachments)/?$"),
    _rule(frozenset({"POST"}), r"^correspondence/labels/?$"),
    _rule(frozenset({"POST", "DELETE"}), rf"^correspondence/{_ID}/labels/{_ID}/?$"),
    # tasks: read, create, update, delete, complete.
    _rule(_R, r"^tasks/?$"),
    _rule(_R, r"^tasks/(my-tasks|stats)/?$"),
    _rule(_R, r"^tasks/my-counts/?$"),
    _rule(_R, rf"^tasks/{_ID}/?$"),
    _rule(frozenset({"POST"}), r"^tasks/?$"),
    _rule(frozenset({"PATCH"}), rf"^tasks/{_ID}/?$"),
    _rule(frozenset({"DELETE"}), rf"^tasks/{_ID}/?$"),
    _rule(frozenset({"POST"}), rf"^tasks/{_ID}/complete/?$"),
    # comments (entity access is checked per entity in the handler)
    _rule(_R | {"POST"}, r"^collaboration/comments/?$"),
    _rule(frozenset({"PATCH", "DELETE"}), rf"^collaboration/comments/{_ID}/?$"),
    # meetings (every handler enforces verify_project_access)
    _rule(_R | {"POST", "PATCH", "DELETE"}, r"^meetings(/.*)?$"),
    # timeline (project timeline feed enforces verify_project_access)
    _rule(_R, rf"^timeline/projects/{_ID}/?$"),
    # schedule (read-only views enforce verify_project_access)
    _rule(_R, r"^schedule(/.*)?$"),
    # documents / photos: read
    _rule(_R, r"^documents/?$"),
    _rule(_R, rf"^documents/{_ID}(/(download|references))?/?$"),
    _rule(_R, r"^documents/file-types-by-project/?$"),
    # file side panel: activity timeline and tags of one file.
    _rule(_R, rf"^documents/{_ID}/activity/?$"),
    _rule(_R, r"^file-tags/by-file/?$"),
    _rule(_R, r"^documents/photos(/.*)?$"),
    _rule(_R, r"^documents/chat-file-url/?$"),
    # document upload, patch, delete
    _rule(frozenset({"POST"}), r"^documents/upload/?$"),
    _rule(frozenset({"PATCH"}), rf"^documents/{_ID}/?$"),
    _rule(frozenset({"DELETE"}), rf"^documents/{_ID}/?$"),
    # photo upload (with caption), patch, delete
    _rule(frozenset({"POST"}), r"^documents/photos/upload/?$"),
    _rule(frozenset({"PATCH"}), rf"^documents/photos/{_ID}/?$"),
    _rule(frozenset({"DELETE"}), rf"^documents/photos/{_ID}/?$"),
    # team-chat: rooms, messages, WebSocket
    _rule(_R | {"POST", "PATCH"}, r"^team-chat(/.*)?$"),
    _rule(_R | {"POST", "PATCH"}, r"^team_chat(/.*)?$"),
    # global search: read only. Handler scopes hits to the caller's projects and
    # narrows collections with ``restrict_search_types``.
    _rule(_R, r"^search/?$"),
    _rule(_R, r"^search/(status|types)/?$"),
    # semantic-search encoder state: the search modal reads it to show a hint. Read only.
    _rule(_R, r"^ai-estimator/embedding-model/status/?$"),
    # own notifications (the shell polls unread-count)
    _rule(_ANY, r"^notifications(/.*)?$"),
    # personal notes: every query is scoped to the caller (owner_user_id)
    _rule(_ANY, r"^notes/?$"),
    _rule(_ANY, rf"^notes/{_ID}/?$"),
    # project teams list: read only; service gates on project access (404 otherwise)
    _rule(frozenset({"GET"}), rf"^teams/project/{_ID}/?$"),
    # shell: enabled-module list (read only)
    _rule(_R, r"^modules/?$"),
    # admin-controlled help banners: read only
    _rule(_R, r"^info-banners/?$"),
)


# Collections a restricted user may search: only what they can open (tasks, documents).
RESTRICTED_SEARCH_COLLECTIONS: tuple[str, ...] = ("oe_tasks", "oe_documents")


def restrict_search_types(canonical: list[str]) -> list[str]:
    """Keep only collections a restricted user may see; never empty-means-all."""
    return [c for c in canonical if c in RESTRICTED_SEARCH_COLLECTIONS]


def is_restricted_user(user: Any) -> bool:
    """True when the user gets restricted project-user mode. Admin never is.

    [RSC-IRAN] Step 4.2: EVERY non-admin is restricted by default (global manager too).
    """
    if getattr(user, "role", "") == "admin":
        return False
    if os.environ.get("OCE_RESTRICTED_PROJECT_MODE_ALL", "").strip().lower() in ("1", "true", "yes"):
        return True
    meta = getattr(user, "metadata_", None) or {}
    flag = meta.get("restricted_project_mode")
    if flag is True:
        return True
    if flag is False:
        # Explicit opt-out set by an admin for a power user.
        return False
    # Deny by default: EVERY non-admin is restricted (global manager too). [RSC-IRAN]
    return True


def is_path_allowed(method: str, path: str) -> bool:
    if not path.startswith(API_PREFIX):
        return False
    rel = path[len(API_PREFIX) :]
    method = method.upper()
    for methods, pattern in _ALLOWED:
        if (methods is None or method in methods) and pattern.match(rel):
            return True
    return False


def enforce_restricted_access(method: str, path: str) -> None:
    """Raise 403 unless the restricted user may call ``method path``."""
    if not is_path_allowed(method, path):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available in restricted mode",
        )
