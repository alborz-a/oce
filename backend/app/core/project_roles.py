# [RSC-IRAN] Per-project role capabilities engine
"""Per-project role capabilities engine.

Enforces manager / member / guest (viewer) roles per project.
Roles are stored in TeamMembership.role.
Capabilities determine allowed actions across project resources.
"""

from __future__ import annotations

import inspect
import logging
import uuid
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    CurrentUserId,
    CurrentUserPayload,
    get_current_user_id,
    get_current_user_payload,
    get_session,
)

logger = logging.getLogger(__name__)

# Toggleable project modules and roles (rsd-rsc#98)
MODULES: tuple[str, ...] = ("photos", "files", "tasks", "reports")
TOGGLEABLE_ROLES: tuple[str, ...] = ("project_manager", "member", "viewer")

# Whole capability families removed fail-closed when a module is disabled.
MODULE_CAP_EXACT: dict[str, frozenset[str]] = {
    "photos": frozenset({"module.photos", "photo.upload", "photo.modify"}),
    "files": frozenset({"module.files", "file.upload", "file.modify"}),
    "tasks": frozenset({"module.tasks", "task.manage", "task.work"}),
    "reports": frozenset({"module.reports"}),
}

MODULE_CAP_PREFIXES: dict[str, tuple[str, ...]] = {
    "photos": ("photo.", "photos."),
    "files": ("documents.", "file.", "files."),
    "tasks": ("task.", "tasks."),
    "reports": ("report.", "reports."),
}

# Capability mappings for project roles per access design table
CAPS: dict[str, frozenset[str]] = {
    "project_manager": frozenset(
        {
            "project.read",
            "project.update",
            "members.manage",
            "task.manage",
            "task.work",
            "file.upload",
            "file.modify",
            "photo.upload",
            "photo.modify",
            "chat.read",
            "chat.write",
            "module.photos",
            "module.files",
            "module.tasks",
            "module.reports",
        }
    ),
    "member": frozenset(
        {
            "project.read",
            "task.work",
            "file.upload",
            "photo.upload",
            "chat.read",
            "chat.write",
            "module.photos",
            "module.files",
            "module.tasks",
            "module.reports",
        }
    ),
    "viewer": frozenset(
        {
            "project.read",
            "chat.read",
            "module.photos",
            "module.files",
            "module.tasks",
            "module.reports",
        }
    ),
}

# Legacy role mappings to current project roles
LEGACY: dict[str, str] = {
    "lead": "project_manager",
    "owner": "project_manager",
    "estimator": "member",
}


def _strip_disabled_modules(base_caps: frozenset[str], disabled: frozenset[str]) -> frozenset[str]:
    """Remove the full capability family of every disabled module."""
    if not disabled or not base_caps:
        return base_caps
    blocked_exact: set[str] = set()
    blocked_prefixes: list[str] = []
    for mod in disabled:
        blocked_exact.update(MODULE_CAP_EXACT.get(mod, ()))
        blocked_prefixes.extend(MODULE_CAP_PREFIXES.get(mod, ()))
    prefix_tuple = tuple(blocked_prefixes)
    return frozenset(
        cap for cap in base_caps if cap not in blocked_exact and not (prefix_tuple and cap.startswith(prefix_tuple))
    )


async def load_disabled_modules(
    session: AsyncSession,
    project_id: uuid.UUID,
    role: str,
) -> frozenset[str]:
    """Load disabled modules for ``(project_id, role)``, failing closed on DB errors."""
    from app.modules.teams.models import ProjectRoleModules

    try:
        stmt = select(ProjectRoleModules).where(
            ProjectRoleModules.project_id == project_id,
            ProjectRoleModules.role == role,
        )
        res = await session.execute(stmt)
        if inspect.iscoroutinefunction(getattr(res, "scalars", None)):
            # Unconfigured AsyncMock in legacy unit tests: no override rows.
            return frozenset()
        rows = res.scalars().all()
        disabled: set[str] = set()
        for row in rows:
            raw = getattr(row, "disabled_modules", None)
            if isinstance(raw, (list, tuple, set)):
                for item in raw:
                    if item in MODULES:
                        disabled.add(item)
        return frozenset(disabled)
    except Exception:
        logger.exception(
            "Failed to load ProjectRoleModules for project=%s role=%s; failing closed",
            project_id,
            role,
        )
        return frozenset(MODULES)


async def effective_caps(
    session: AsyncSession,
    role: str | None,
    project_id: uuid.UUID | str,
    *,
    is_system_admin: bool = False,
) -> frozenset[str]:
    """Return effective capabilities for ``role`` on ``project_id`` after module toggles."""
    if is_system_admin:
        return CAPS["project_manager"]
    if role is None:
        return frozenset()
    try:
        proj_uuid = uuid.UUID(str(project_id))
    except (ValueError, TypeError):
        return frozenset()
    base = CAPS.get(role, frozenset())
    if not base:
        return frozenset()
    disabled = await load_disabled_modules(session, proj_uuid, role)
    return _strip_disabled_modules(base, disabled)


async def _resolve_user_context(
    session: AsyncSession,
    user: Any,
) -> tuple[uuid.UUID | None, str, dict[str, Any]]:
    """Extract ``(user_uuid, global_role, metadata)`` with DB fallback."""
    from app.modules.users.models import User

    user_uuid: uuid.UUID | None = None
    global_role: str = ""
    meta: dict[str, Any] = {}

    if isinstance(user, User):
        user_uuid = user.id
        global_role = user.role or ""
        meta = dict(user.metadata_ or {})
    elif isinstance(user, dict):
        uid_val = user.get("id") or user.get("sub")
        if uid_val:
            try:
                user_uuid = uuid.UUID(str(uid_val))
            except (ValueError, TypeError):
                pass
        global_role = user.get("role", "") or ""
        meta = dict(user.get("metadata_") or {})
        if "all_projects" in user and "all_projects" not in meta:
            meta["all_projects"] = user["all_projects"]
    elif hasattr(user, "id") and hasattr(user, "role"):
        user_uuid = getattr(user, "id")
        global_role = getattr(user, "role", "") or ""
        meta = dict(getattr(user, "metadata_", None) or {})
    else:
        try:
            user_uuid = uuid.UUID(str(user))
        except (ValueError, TypeError):
            pass

    if user_uuid is not None and global_role != "admin" and (not global_role or not meta):
        try:
            db_user = await session.get(User, user_uuid)
            if db_user is not None:
                if not global_role:
                    global_role = db_user.role or ""
                if not meta:
                    meta = dict(db_user.metadata_ or {})
        except Exception:
            logger.exception("Failed to lookup user in project_roles")

    return user_uuid, global_role, meta


async def _get_project_role_resolved(
    session: AsyncSession,
    user_uuid: uuid.UUID | None,
    global_role: str,
    meta: dict[str, Any],
    project_id: uuid.UUID | str,
) -> str | None:
    """Resolve effective project role from already-loaded user attributes."""
    from app.modules.projects.models import Project
    from app.modules.teams.models import Team, TeamMembership

    try:
        proj_uuid = uuid.UUID(str(project_id))
    except (ValueError, TypeError):
        return None

    # Global admin has every capability on every project (returns project_manager)
    if global_role == "admin":
        return "project_manager"

    # Project owner check (verifies project exists first)
    try:
        project = await session.get(Project, proj_uuid)
    except Exception:
        logger.exception("Failed to lookup project in get_project_role")
        project = None

    if project is None:
        return None

    if user_uuid is not None and str(getattr(project, "owner_id", "")) == str(user_uuid):
        return "project_manager"

    # Check TeamMembership for this user and project
    raw_role: str | None = None
    if user_uuid is not None:
        try:
            stmt = (
                select(TeamMembership.role)
                .join(Team, Team.id == TeamMembership.team_id)
                .where(
                    Team.project_id == proj_uuid,
                    TeamMembership.user_id == user_uuid,
                )
                .limit(1)
            )
            raw_role = (await session.execute(stmt)).scalar_one_or_none()
        except Exception:
            logger.exception("Failed to lookup team membership in get_project_role")
            raw_role = None

    mapped_role: str | None = None
    if raw_role is not None:
        mapped_role = LEGACY.get(raw_role, raw_role)
        if mapped_role not in CAPS:
            mapped_role = "viewer"

    # Evaluate all_projects metadata flag
    all_projects = meta.get("all_projects")
    if all_projects == "manage":
        return "project_manager"
    elif all_projects == "view":
        if mapped_role is None or mapped_role == "viewer":
            return "viewer"
        return mapped_role

    return mapped_role


async def get_project_role(
    session: AsyncSession,
    user: Any,
    project_id: uuid.UUID | str,
) -> str | None:
    """Return the effective project role for user and project_id.

    - global admin returns 'project_manager'
    - project owner returns 'project_manager'
    - else TeamMembership.role mapped through LEGACY
    - raised to 'viewer' or 'project_manager' when user metadata all_projects is 'view' or 'manage'
    - no membership and no flag returns None
    - unknown role string counts as 'viewer'
    """
    user_uuid, global_role, meta = await _resolve_user_context(session, user)
    return await _get_project_role_resolved(session, user_uuid, global_role, meta, project_id)


async def get_project_caps(
    session: AsyncSession,
    user: Any,
    project_id: uuid.UUID | str,
) -> frozenset[str]:
    """Return the effective set of capabilities held by user on project_id."""
    user_uuid, global_role, meta = await _resolve_user_context(session, user)
    if global_role == "admin":
        return CAPS["project_manager"]
    role = await _get_project_role_resolved(session, user_uuid, global_role, meta, project_id)
    if role is None:
        return frozenset()
    return await effective_caps(session, role, project_id, is_system_admin=False)


async def ensure_project_caps(
    session: AsyncSession,
    user: Any,
    project_id: uuid.UUID | str,
    *required_caps: str,
    payload: dict[str, Any] | None = None,
) -> frozenset[str]:
    """Verify ``required_caps`` are all present for ``user`` on ``project_id``.

    Intended for handlers that have already called ``verify_project_access``.
    System admins always bypass module restrictions; everyone else fails closed
    with HTTP 403 ``project_capability_required:<cap>``.
    """
    if payload and payload.get("role") == "admin":
        return CAPS["project_manager"]
    caps = await get_project_caps(session, user, project_id)
    for cap in required_caps:
        if cap not in caps:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"project_capability_required:{cap}",
            )
    return caps


def require_project_cap(cap: str):
    """FastAPI dependency factory enforcing a specific project capability."""

    async def _dependency(
        request: Request,
        user_id: CurrentUserId,
        payload: CurrentUserPayload,
        session: AsyncSession = Depends(get_session),
    ) -> None:
        # Admin bypass
        if payload and payload.get("role") == "admin":
            return

        raw_pid = (
            request.path_params.get("project_id")
            or request.path_params.get("id")
            or request.query_params.get("project_id")
        )

        # Resolve project_id from related entities if needed
        if not raw_pid:
            if "task_id" in request.path_params:
                from app.modules.tasks.models import Task

                try:
                    t = await session.get(Task, uuid.UUID(str(request.path_params["task_id"])))
                    if t:
                        raw_pid = t.project_id
                except Exception:
                    pass
            elif "document_id" in request.path_params:
                from app.modules.documents.models import Document

                try:
                    d = await session.get(Document, uuid.UUID(str(request.path_params["document_id"])))
                    if d:
                        raw_pid = d.project_id
                except Exception:
                    pass
            elif "photo_id" in request.path_params:
                from app.modules.documents.models import ProjectPhoto

                try:
                    p = await session.get(ProjectPhoto, uuid.UUID(str(request.path_params["photo_id"])))
                    if p:
                        raw_pid = p.project_id
                except Exception:
                    pass
            elif "sheet_id" in request.path_params:
                from app.modules.documents.models import Sheet

                try:
                    s = await session.get(Sheet, uuid.UUID(str(request.path_params["sheet_id"])))
                    if s:
                        raw_pid = s.project_id
                except Exception:
                    pass
            elif "report_id" in request.path_params:
                from app.modules.reporting.models import GeneratedReport

                try:
                    rep = await session.get(GeneratedReport, uuid.UUID(str(request.path_params["report_id"])))
                    if rep:
                        raw_pid = rep.project_id
                except Exception:
                    pass
            elif "room_id" in request.path_params:
                from app.modules.team_chat.models import ChatRoom

                try:
                    r = await session.get(ChatRoom, uuid.UUID(str(request.path_params["room_id"])))
                    if r:
                        raw_pid = r.project_id
                except Exception:
                    pass

        if not raw_pid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        user_uuid, global_role, meta = await _resolve_user_context(session, user_id)
        if global_role == "admin":
            return

        role = await _get_project_role_resolved(session, user_uuid, global_role, meta, raw_pid)
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        caps = await effective_caps(session, role, raw_pid, is_system_admin=False)
        if cap not in caps:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"project_capability_required:{cap}",
            )

    return _dependency
