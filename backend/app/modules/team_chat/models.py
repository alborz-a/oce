# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat ORM models.

Tables:
    oe_team_chat_room     - company / project / group / dm rooms
    oe_team_chat_member   - membership (group, dm) and per-user read state (every kind)
    oe_team_chat_message  - messages, optionally carrying linked document ids
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import GUID, Base


class ChatRoom(Base):
    __tablename__ = "oe_team_chat_room"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_oe_team_chat_room_project"),
        UniqueConstraint("source_id", name="uq_oe_team_chat_room_source"),
        UniqueConstraint("dm_key", name="uq_oe_team_chat_room_dm_key"),
    )

    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # company|project|group|dm
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("oe_projects_project.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, default="")
    dm_key: Mapped[str | None] = mapped_column(String(80), nullable=True)  # sorted "<uid>:<uid>"
    source_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # import idempotency key
    metadata_: Mapped[dict] = mapped_column(  # type: ignore[assignment]
        "metadata", JSON, nullable=False, default=dict, server_default="{}"
    )


class ChatMember(Base):
    __tablename__ = "oe_team_chat_member"
    __table_args__ = (UniqueConstraint("room_id", "user_id", name="uq_oe_team_chat_member"),)

    room_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("oe_team_chat_room.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")  # member|owner
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChatMessage(Base):
    __tablename__ = "oe_team_chat_message"
    __table_args__ = (
        Index("ix_oe_team_chat_message_room_created", "room_id", "created_at"),
        UniqueConstraint("source_id", name="uq_oe_team_chat_message_source"),
    )

    room_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("oe_team_chat_room.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    document_ids: Mapped[list] = mapped_column(  # type: ignore[assignment]
        JSON, nullable=False, default=list, server_default="[]"
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # import idempotency key
    metadata_: Mapped[dict] = mapped_column(  # type: ignore[assignment]
        "metadata", JSON, nullable=False, default=dict, server_default="{}"
    )
