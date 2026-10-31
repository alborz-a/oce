"""Guide override ORM model.

One row per (module_key, scope, scope_value). scope is 'global', 'role' or 'user';
scope_value is '' for global, the role name for role, the user id for user.
visible NULL means "not set at this scope"; content NULL means "keep the built-in text".
"""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GuideOverride(Base):
    __tablename__ = "oe_guide_override"
    __table_args__ = (
        UniqueConstraint("module_key", "scope", "scope_value", name="uq_guide_override_key"),
        Index("ix_guide_override_module", "module_key"),
    )

    module_key: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str] = mapped_column(String(8), nullable=False)
    scope_value: Mapped[str] = mapped_column(String(64), nullable=False, default="", server_default="")
    visible: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
