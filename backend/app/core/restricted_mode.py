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
    # projects: read only (list is membership-limited in the handler)
    _rule(_R, r"^projects/?$"),
    _rule(_R, rf"^projects/{_ID}/?$"),
    _rule(_R, rf"^projects/{_ID}/members/?$"),
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
    _rule(_R, r"^documents/photos(/.*)?$"),
    # photo upload (with caption) and caption update. No delete.
    _rule(frozenset({"POST"}), r"^documents/photos/upload/?$"),
    _rule(frozenset({"PATCH"}), rf"^documents/photos/{_ID}/?$"),
    # own notifications (the shell polls unread-count)
    _rule(_ANY, r"^notifications(/.*)?$"),
    # shell: enabled-module list (read only)
    _rule(_R, r"^modules/?$"),
)


def is_restricted_user(user: Any) -> bool:
    """True when the user gets restricted project-user mode. Admin never is."""
    if getattr(user, "role", "") == "admin":
        return False
    if os.environ.get("OCE_RESTRICTED_PROJECT_MODE_ALL", "").strip().lower() in ("1", "true", "yes"):
        return True
    meta = getattr(user, "metadata_", None) or {}
    return meta.get("restricted_project_mode") is True


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
