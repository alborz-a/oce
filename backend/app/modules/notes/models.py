# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Personal notes ORM model.

Table:
    oe_notes_user_note - one row per note, owned by exactly one user (owner_user_id).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import GUID, Base


class UserNote(Base):
    __tablename__ = "oe_notes_user_note"
    __table_args__ = (Index("ix_oe_notes_user_note_owner_pinned_updated", "owner_user_id", "pinned", "updated_at"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("oe_users_user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#fb0")
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
