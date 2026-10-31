"""Guide overrides API, mounted under /api/v1/guide-overrides/.

    GET    /            Resolved guides for the current user (user > role > global).
    GET    /admin/      Every stored override (system admin).
    PUT    /admin/      Create or update one override (system admin).
    DELETE /admin/{id}/ Remove one override (system admin).
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.dependencies import RequireRole, SessionDep, get_current_user_payload
from app.modules.guide_overrides.models import GuideOverride

router = APIRouter(tags=["guide_overrides"])

_PRIORITY = {"global": 0, "role": 1, "user": 2}


class GuideSection(BaseModel):
    title: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=4000)


class GuideContent(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    intro: str | None = Field(default=None, max_length=2000)
    sections: list[GuideSection] = Field(default_factory=list, max_length=30)


class OverrideIn(BaseModel):
    module_key: str = Field(..., min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    scope: Literal["global", "role", "user"]
    scope_value: str = Field(default="", max_length=64)
    visible: bool | None = None
    content: GuideContent | None = None


class OverrideOut(BaseModel):
    id: str
    module_key: str
    scope: str
    scope_value: str
    visible: bool | None
    content: dict[str, Any] | None


def _out(r: GuideOverride) -> OverrideOut:
    return OverrideOut(
        id=str(r.id),
        module_key=r.module_key,
        scope=r.scope,
        scope_value=r.scope_value,
        visible=r.visible,
        content=r.content,
    )


@router.get("/")
async def resolved_guides(
    session: SessionDep,
    payload: Annotated[dict[str, Any], Depends(get_current_user_payload)],
) -> dict[str, dict[str, Any]]:
    """Per module: {visible, content}. A module with no row is hidden for normal users."""
    user_id = str(payload.get("sub", ""))
    role = str(payload.get("role", "")).strip().lower()
    rows = (await session.execute(select(GuideOverride))).scalars().all()
    out: dict[str, dict[str, Any]] = {}
    for r in sorted(rows, key=lambda x: _PRIORITY.get(x.scope, 0)):
        if r.scope == "user" and r.scope_value != user_id:
            continue
        if r.scope == "role" and r.scope_value.lower() != role:
            continue
        cur = out.setdefault(r.module_key, {"visible": False, "content": None})
        if r.visible is not None:
            cur["visible"] = r.visible
        if r.content is not None:
            cur["content"] = r.content
    return out


@router.get("/admin/", response_model=list[OverrideOut], dependencies=[Depends(RequireRole("admin"))])
async def list_overrides(session: SessionDep) -> list[OverrideOut]:
    rows = (await session.execute(select(GuideOverride).order_by(GuideOverride.module_key))).scalars().all()
    return [_out(r) for r in rows]


@router.put("/admin/", response_model=OverrideOut, dependencies=[Depends(RequireRole("admin"))])
async def upsert_override(body: OverrideIn, session: SessionDep) -> OverrideOut:
    value = "" if body.scope == "global" else body.scope_value.strip()
    if body.scope != "global" and not value:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="scope_value required")
    row = (
        await session.execute(
            select(GuideOverride).where(
                GuideOverride.module_key == body.module_key,
                GuideOverride.scope == body.scope,
                GuideOverride.scope_value == value,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = GuideOverride(module_key=body.module_key, scope=body.scope, scope_value=value)
        session.add(row)
    row.visible = body.visible
    row.content = body.content.model_dump() if body.content else None
    await session.flush()
    return _out(row)


@router.delete(
    "/admin/{override_id}/",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RequireRole("admin"))],
)
async def delete_override(override_id: uuid.UUID, session: SessionDep) -> None:
    row = await session.get(GuideOverride, override_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await session.delete(row)
