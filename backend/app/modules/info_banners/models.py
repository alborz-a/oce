"""Info banner ORM model: one row per page key (the banner storageKey)."""

from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InfoBanner(Base):
    __tablename__ = "oe_info_banner"

    page_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    text: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
