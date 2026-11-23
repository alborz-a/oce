"""API scope for staff accounts (global role editor or viewer).

Deny by default: an authenticated staff user may call ``/api/v1/*`` only under
the prefixes in ``STAFF_API_PREFIXES`` (the Mizito shell). Admin and manager are
not affected. Unauthenticated routes (login, public share / portal / field
magic links) never reach this check, because it runs only after a valid token.

The list follows the endpoints the shell frontend calls. Add a prefix here when
a shell page needs a new endpoint; never widen it for an OCE-only module.
"""

from __future__ import annotations

import re

from fastapi import HTTPException, status

from app.core.permissions import Role, _resolve_role

API_PREFIX = "/api/v1/"

# Path segments after /api/v1/. Matched on whole segments: "users" also covers
# users/me, users/{id}/avatar and the colleague list.
STAFF_API_PREFIXES: tuple[str, ...] = (
    # Shell pages (frontend/src/features/projects/workspace, features/correspondence,
    # modules/team-chat, app/normalUserRoutes.ts).
    "auth",
    "users",
    "profile",
    "colleagues",
    "projects",
    "team_chat",
    "team-chat",
    "tasks",
    "collaboration",
    "documents",
    "photos",
    "meetings",
    "teams",
    "notifications",
    "global_presence",
    "correspondence",
    "notes",
    "contacts",
    "timeline",
    "modules",
    "company",
    # App boot, used by the shell on every page (i18n/translation/branding/license/
    # sidebar/activity/packs loaders). Not shell-page specific.
    "i18n",
    "translation",
    "branding",
    "license",
    "licenses",
    "sidebar",
    "activity",
    "company-profile",
    "partner-pack",
    "packs",
    "guide-overrides",
    "info-banners",
    # Infra.
    "health",
    "openapi",
    "docs",
)

_STAFF_RE = re.compile(
    r"^" + re.escape(API_PREFIX) + r"(?:" + "|".join(re.escape(p) for p in STAFF_API_PREFIXES) + r")(?:/|$)"
)

_ENGINEERING_ROLES = frozenset({Role.ADMIN, Role.MANAGER})


def is_staff_role(role: object) -> bool:
    """True for any role that is not admin or manager. Unknown roles count as staff."""
    resolved = _resolve_role(str(role or ""))
    return resolved not in _ENGINEERING_ROLES


def is_staff_path_allowed(path: str) -> bool:
    """True when ``path`` is outside ``/api/v1/`` or inside a shell prefix."""
    if not path.startswith(API_PREFIX):
        return True
    return _STAFF_RE.match(path) is not None


def enforce_staff_scope(role: object, path: str) -> None:
    """Raise 403 when a staff user asks for an OCE-only ``/api/v1`` path."""
    if not is_staff_role(role) or is_staff_path_allowed(path):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This area is not available for staff accounts",
    )


def is_staff_ws_allowed(role: object, path: str) -> bool:
    """WebSocket twin of :func:`enforce_staff_scope`: True when the socket path is open to this role."""
    return not is_staff_role(role) or is_staff_path_allowed(path)
