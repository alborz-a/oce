"""Info banners API, mounted under /api/v1/info-banners/.

    GET  /               Every banner row {page_key: {visible, text}} (any authenticated user, read-only).
    PUT  /{page_key}/    Create or update one banner (system admin only).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.dependencies import RequireRole, SessionDep, get_current_user_payload
from app.modules.info_banners.models import InfoBanner

router = APIRouter(tags=["info_banners"])


class BannerIn(BaseModel):
    visible: bool = False
    text: str | None = Field(default=None, max_length=4000)


class BannerOut(BaseModel):
    page_key: str
    visible: bool
    text: str | None


def _out(r: InfoBanner) -> BannerOut:
    return BannerOut(page_key=r.page_key, visible=bool(r.visible), text=r.text)


@router.get("/")
async def list_banners(
    session: SessionDep,
    _payload: Annotated[dict[str, Any], Depends(get_current_user_payload)],
) -> dict[str, dict[str, Any]]:
    rows = (await session.execute(select(InfoBanner))).scalars().all()
    return {r.page_key: {"visible": bool(r.visible), "text": r.text} for r in rows}


@router.put("/{page_key}/", response_model=BannerOut, dependencies=[Depends(RequireRole("admin"))])
async def upsert_banner(page_key: str, body: BannerIn, session: SessionDep) -> BannerOut:
    key = page_key.strip()[:128]
    row = (await session.execute(select(InfoBanner).where(InfoBanner.page_key == key))).scalar_one_or_none()
    if row is None:
        row = InfoBanner(page_key=key)
        session.add(row)
    row.visible = body.visible
    row.text = (body.text or "").strip() or None
    await session.flush()
    return _out(row)
