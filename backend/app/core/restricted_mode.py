"""Restricted project-user mode: server-side enforcement.

One place decides. ``get_current_user_payload`` (every authenticated route
goes through it) loads the user row once, calls :func:`is_restricted_user`
and then :func:`enforce_restricted_access`. Deny by default: a restricted
user may only call the (method, path) pairs in ``_ALLOWED`` below. Per-object
checks (project membership) stay in each handler via ``verify_project_access``.
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
_ALLOWED: tuple[tuple[frozenset[str] | None, re.Pattern[str]], ...] = (
    # auth + own profile / avatar / own password
    _rule(_ANY, r"^users/auth(/.*)?$"),
    _rule(_ANY, r"^users/me(/.*)?$"),
    # other users' profile pictures (avatar image only; no user list, no edit)
    _rule(_R, rf"^users/{_ID}/avatar/?$"),
    # projects: read only (list is membership-limited in the handler)
    _rule(_R, r"^projects/?$"),
    _rule(_R, rf"^projects/{_ID}/?$"),
    _rule(_R, rf"^projects/{_ID}/members/?$"),
    # project file manager (documents + photos list, tree, storage locations). Read only;
    # membership is checked in the handler. Backs the project Photos tab and the files page.
    _rule(_R, rf"^projects/{_ID}/files(/(tree|locations))?/?$"),
    # tasks: read, change (status etc.), complete. NO create, NO delete, NO batch, NO import/export.
    _rule(_R, r"^tasks/?$"),
    _rule(_R, r"^tasks/(my-tasks|stats)/?$"),
    _rule(_R, rf"^tasks/{_ID}/?$"),
    _rule(frozenset({"PATCH"}), rf"^tasks/{_ID}/?$"),
    _rule(frozenset({"POST"}), rf"^tasks/{_ID}/complete/?$"),
    # comments (entity access is checked per entity in the handler)
    _rule(_R | {"POST"}, r"^collaboration/comments/?$"),
    # documents / photos: read
    _rule(_R, r"^documents/?$"),
    _rule(_R, rf"^documents/{_ID}(/(download|references))?/?$"),
    _rule(_R, r"^documents/file-types-by-project/?$"),
    # file side panel: activity timeline and tags of one file. Read only;
    # the handlers check project membership via ``verify_project_access``.
    _rule(_R, rf"^documents/{_ID}/activity/?$"),
    _rule(_R, r"^file-tags/by-file/?$"),
    _rule(_R, r"^documents/photos(/.*)?$"),
    # document upload (needs documents.create; membership + folder grants checked in the handler). No delete.
    _rule(frozenset({"POST"}), r"^documents/upload/?$"),
    # photo upload (with caption) and caption update. No delete.
    _rule(frozenset({"POST"}), r"^documents/photos/upload/?$"),
    _rule(frozenset({"PATCH"}), rf"^documents/photos/{_ID}/?$"),
    # global search: read only. Handler scopes hits to the caller's projects and
    # narrows collections with ``restrict_search_types``.
    _rule(_R, r"^search/?$"),
    _rule(_R, r"^search/(status|types)/?$"),
    # own notifications (the shell polls unread-count)
    _rule(_ANY, r"^notifications(/.*)?$"),
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
    """True when the user gets restricted project-user mode. Admin never is."""
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
    # Deny by default: an account nobody flagged (new staff, self-registered,
    # imported) must not get the full platform menu and pages. Only managers
    # (and admins, handled above) are unrestricted unless flagged otherwise.
    return getattr(user, "role", "") != "manager"


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
