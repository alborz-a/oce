# [RSC-IRAN] Per-project role capabilities engine
"""Per-project role capabilities engine.

Enforces manager / member / guest (viewer) roles per project.
Roles are stored in TeamMembership.role.
Capabilities determine allowed actions across project resources.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import JSON, String, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.dependencies import (
    CurrentUserId,
    CurrentUserPayload,
    get_current_user_id,
    get_current_user_payload,
    get_session,
)

logger = logging.getLogger(__name__)

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
            "chat.read",
            "chat.write",
        }
    ),
    "member": frozenset(
        {
            "project.read",
            "task.work",
            "file.upload",
            "chat.read",
            "chat.write",
        }
    ),
    "viewer": frozenset(
        {
            "project.read",
            "chat.read",
        }
    ),
}

# Legacy role mappings to current project roles
LEGACY: dict[str, str] = {
    "lead": "project_manager",
    "owner": "project_manager",
    "estimator": "member",
}

# Per-module switches (RSD-0.50 H1). Every project role starts with every module
# on, so default behaviour is unchanged. An admin can switch a module off for one
# role; the module cap is then removed from that role's effective caps and every
# handler guarded by require_project_cap("module.<name>") answers 403.
MODULES: tuple[str, ...] = ("photos", "files", "tasks", "reports")
MODULE_CAP: dict[str, str] = {m: f"module.{m}" for m in MODULES}
ASSIGNABLE_ROLES: tuple[str, ...] = ("member", "project_manager", "viewer")

CAPS = {role: caps | frozenset(MODULE_CAP.values()) for role, caps in CAPS.items()}


class ProjectRoleModules(Base):
    """One row per project role that has at least one module switched off."""

    __tablename__ = "oe_project_role_modules"

    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    disabled_modules: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)


async def load_disabled_modules(session: AsyncSession) -> dict[str, frozenset[str]]:
    """Return {role: disabled module names}. Errors propagate: fail closed."""
    rows = (await session.execute(select(ProjectRoleModules))).scalars().all()
    return {r.role: frozenset(m for m in (r.disabled_modules or []) if m in MODULES) for r in rows}


async def effective_caps(session: AsyncSession, role: str) -> frozenset[str]:
    """CAPS for role minus the module caps switched off for that role."""
    base = CAPS.get(role, frozenset())
    disabled = (await load_disabled_modules(session)).get(role, frozenset())
    return base - {MODULE_CAP[m] for m in disabled}


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
    from app.modules.projects.models import Project
    from app.modules.teams.models import Team, TeamMembership
    from app.modules.users.models import User

    # Normalize project UUID
    try:
        proj_uuid = uuid.UUID(str(project_id))
    except (ValueError, TypeError):
        return None

    # Resolve user attributes
    user_uuid: uuid.UUID | None = None
    global_role: str = ""
    meta: dict[str, Any] = {}

    if isinstance(user, User):
        user_uuid = user.id
        global_role = user.role or ""
        meta = user.metadata_ or {}
    elif isinstance(user, dict):
        uid_val = user.get("id") or user.get("sub")
        if uid_val:
            try:
                user_uuid = uuid.UUID(str(uid_val))
            except (ValueError, TypeError):
                pass
        global_role = user.get("role", "") or ""
        meta = user.get("metadata_") or {}
        if "all_projects" in user and "all_projects" not in meta:
            meta["all_projects"] = user["all_projects"]
    elif hasattr(user, "id") and hasattr(user, "role"):
        user_uuid = getattr(user, "id")
        global_role = getattr(user, "role", "") or ""
        meta = getattr(user, "metadata_", None) or {}
    else:
        try:
            user_uuid = uuid.UUID(str(user))
        except (ValueError, TypeError):
            pass

    # If user object wasn't passed or lacked role/metadata, load from DB
    if user_uuid is not None and (not global_role or not meta):
        try:
            db_user = await session.get(User, user_uuid)
            if db_user is not None:
                if not global_role:
                    global_role = db_user.role or ""
                if not meta:
                    meta = db_user.metadata_ or {}
        except Exception:
            logger.exception("Failed to lookup user in get_project_role")

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
        # higher existing role wins (member or project_manager)
        return mapped_role

    return mapped_role


async def get_project_caps(
    session: AsyncSession,
    user: Any,
    project_id: uuid.UUID | str,
) -> frozenset[str]:
    """Return the set of capabilities held by user on project_id."""
    role = await get_project_role(session, user, project_id)
    if role is None:
        return frozenset()
    return await effective_caps(session, role)


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

        role = await get_project_role(session, user_id, raw_pid)
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        caps = await effective_caps(session, role)
        if cap not in caps:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"project_capability_required:{cap}",
            )

    return _dependency
