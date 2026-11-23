# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Correspondence ORM models.

Tables:
    oe_correspondence_correspondence - project correspondence with direction and contact tracking
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import GUID, Base


class Correspondence(Base):
    """One entry in a project's correspondence register, typed by ``CORRESPONDENCE_TYPES``."""

    __tablename__ = "oe_correspondence_correspondence"
    # ``reference_number`` must be unique per project - the auto-generator
    # uses ``MAX(suffix)+1`` which has a TOCTOU race under concurrent
    # creates; without this constraint two parallel POSTs would silently
    # persist ``COR-005`` twice. With the constraint the second commit
    # raises ``IntegrityError`` and the service layer retries.
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "reference_number",
            name="uq_oe_correspondence_correspondence_project_reference",
        ),
        # Secretariat (دبیرخانه) number: one counter for all prefixes, so a number is never issued twice.
        UniqueConstraint(
            "secretariat_number",
            name="uq_oe_correspondence_secretariat_number",
        ),
    )

    # NULL for mailbox letters (user-to-user, see ``sender_user_id``); those are never project-scoped.
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("oe_projects_project.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reference_number: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    from_contact_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # To contact IDs: array of contact UUID strings
    to_contact_ids: Mapped[list] = mapped_column(  # type: ignore[assignment]
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )

    date_sent: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_received: Mapped[str | None] = mapped_column(String(20), nullable=True)
    correspondence_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Linked document IDs: array of document UUID strings
    linked_document_ids: Mapped[list] = mapped_column(  # type: ignore[assignment]
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )

    linked_transmittal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    linked_rfi_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Lifecycle + legal-deadline tracking. A correspondence record, and above
    # all a formal notice, often carries a contractual response deadline; with
    # only CRUD fields the register could not tell an open notice from a closed
    # one, nor flag one whose reply window has lapsed. ``status`` is one of
    # open|awaiting_response|responded|closed; ``response_required_by`` is an ISO
    # date (yyyy-mm-dd); ``contract_clause_ref`` is a free-text clause pointer
    # (for example "NEC cl. 61.3" or "FIDIC 20.1"). is_overdue / days_until_due
    # are computed at serialisation time, never stored.
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="open",
        server_default="open",
        index=True,
    )
    response_required_by: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contract_clause_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Stored attachment paths (validated magic-byte uploads). Server-derived
    # filenames only - the client never controls the path on disk, so we
    # never serve attacker-named extensions back. See router upload handler.
    attachments: Mapped[list] = mapped_column(  # type: ignore[assignment]
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )
    metadata_: Mapped[dict] = mapped_column(  # type: ignore[assignment]
        "metadata",
        JSON,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    # Mailbox letters (نامه‌ها). NULL ``sender_user_id`` = project register row.
    # ``thread_id`` = root letter id; every message of one thread shares it.
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    thread_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Secretariat registration («ثبت در دبیرخانه»). NULL = not registered.
    # Displayed as ``<prefix>- <number> -<postfix>``; see ``secretariat.format_letter_number``.
    secretariat_prefix: Mapped[str | None] = mapped_column(String(10), nullable=True)
    secretariat_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    secretariat_postfix: Mapped[str | None] = mapped_column(String(3), nullable=True)
    secretariat_register_type: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 وارده, 2 صادره
    secretariat_registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Correspondence {self.reference_number} ({self.direction}/{self.correspondence_type})>"


class CorrespondenceLetterRecipient(Base):
    """Per-user participation in one mailbox message. ``kind``: sender | to | forward.

    Drives inbox, outbox, paraph and archived boxes and the access check.
    ``archived_at`` is set per recipient, so archiving never touches other users.
    """

    __tablename__ = "oe_correspondence_letter_recipient"
    __table_args__ = (
        UniqueConstraint("letter_id", "user_id", "kind", name="uq_oe_correspondence_letter_recipient"),
    )

    letter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_correspondence_correspondence.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_users_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CorrespondenceLabel(Base):
    """Mailbox label («برچسب‌ها»). Names are unique per owner (``created_by``)."""

    __tablename__ = "oe_correspondence_label"
    __table_args__ = (UniqueConstraint("created_by", "name", name="uq_oe_correspondence_label_owner_name"),)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)


class CorrespondenceLetterLabel(Base):
    """Links a mailbox message to a label."""

    __tablename__ = "oe_correspondence_letter_label"
    __table_args__ = (UniqueConstraint("letter_id", "label_id", name="uq_oe_correspondence_letter_label"),)

    letter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_correspondence_correspondence.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_correspondence_label.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class CorrespondenceLetterRead(Base):
    """One row per (letter, user) once that user has opened the letter.

    Drives the per-user unread count. Absence of a row means unread.
    Upsert-only: a second open of the same letter is a no-op.
    """

    __tablename__ = "oe_correspondence_letter_read"
    __table_args__ = (UniqueConstraint("letter_id", "user_id", name="uq_oe_correspondence_letter_read_letter_user"),)

    letter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_correspondence_correspondence.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("oe_users_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
