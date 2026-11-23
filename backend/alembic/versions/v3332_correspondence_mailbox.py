# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Correspondence mailbox letters (نامه‌ها) - additive.

- ``oe_correspondence_correspondence``: nullable ``project_id``; new ``sender_user_id``,
  ``thread_id``, ``body_html`` columns (NULL sender = project register row).
- New tables: ``oe_correspondence_letter_recipient``, ``oe_correspondence_label``,
  ``oe_correspondence_letter_label``.

GUID columns are VARCHAR(36). Inspector-guarded, so a re-run is a no-op.

Revision ID: v3332_correspondence_mailbox
Revises: v3331_correspondence_letter_read
Create Date: 2026-11-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3332_correspondence_mailbox"
down_revision = "v3331_correspondence_letter_read"
branch_labels = None
depends_on = None

_LETTER = "oe_correspondence_correspondence"
_RECIPIENT = "oe_correspondence_letter_recipient"
_LABEL = "oe_correspondence_label"
_LETTER_LABEL = "oe_correspondence_letter_label"


def _insp():
    return sa.inspect(op.get_bind())


def _has_table(name: str) -> bool:
    return name in _insp().get_table_names()


def _has_column(table: str, column: str) -> bool:
    return any(c["name"] == column for c in _insp().get_columns(table))


def upgrade() -> None:
    if _has_table(_LETTER):
        with op.batch_alter_table(_LETTER) as batch:
            if not _has_column(_LETTER, "sender_user_id"):
                batch.add_column(sa.Column("sender_user_id", sa.String(length=36), nullable=True))
                batch.create_index("ix_oe_correspondence_correspondence_sender_user_id", ["sender_user_id"])
            if not _has_column(_LETTER, "thread_id"):
                batch.add_column(sa.Column("thread_id", sa.String(length=36), nullable=True))
                batch.create_index("ix_oe_correspondence_correspondence_thread_id", ["thread_id"])
            if not _has_column(_LETTER, "body_html"):
                batch.add_column(sa.Column("body_html", sa.Text(), nullable=True))
            batch.alter_column(
                "project_id",
                existing_type=sa.String(length=36),
                nullable=True,
            )

    if not _has_table(_RECIPIENT):
        op.create_table(
            _RECIPIENT,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "letter_id", sa.String(length=36), sa.ForeignKey(f"{_LETTER}.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column(
                "user_id", sa.String(length=36), sa.ForeignKey("oe_users_user.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("kind", sa.String(length=20), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("letter_id", "user_id", "kind", name="uq_oe_correspondence_letter_recipient"),
        )
        op.create_index("ix_oe_correspondence_letter_recipient_letter_id", _RECIPIENT, ["letter_id"])
        op.create_index("ix_oe_correspondence_letter_recipient_user_id", _RECIPIENT, ["user_id"])

    if not _has_table(_LABEL):
        op.create_table(
            _LABEL,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("name", sa.String(length=100), nullable=False, unique=True),
            sa.Column("created_by", sa.String(length=36), nullable=True),
        )

    if not _has_table(_LETTER_LABEL):
        op.create_table(
            _LETTER_LABEL,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "letter_id", sa.String(length=36), sa.ForeignKey(f"{_LETTER}.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column(
                "label_id", sa.String(length=36), sa.ForeignKey(f"{_LABEL}.id", ondelete="CASCADE"), nullable=False
            ),
            sa.UniqueConstraint("letter_id", "label_id", name="uq_oe_correspondence_letter_label"),
        )
        op.create_index("ix_oe_correspondence_letter_label_letter_id", _LETTER_LABEL, ["letter_id"])
        op.create_index("ix_oe_correspondence_letter_label_label_id", _LETTER_LABEL, ["label_id"])


def downgrade() -> None:
    # Additive migration; downgrade drops only the new tables. Mailbox rows must be removed first (owner decision).
    for table in (_LETTER_LABEL, _LABEL, _RECIPIENT):
        if _has_table(table):
            op.drop_table(table)
