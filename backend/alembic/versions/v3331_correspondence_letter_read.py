# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Correspondence per-user read marks - ``oe_correspondence_letter_read``.

One row per (letter, user) once the user has opened the letter; absence means unread.
GUID columns are VARCHAR(36). Additive: no existing table is touched.
Inspector-guarded, so a re-run or a DB the runtime already auto-created is a no-op.

Revision ID: v3331_correspondence_letter_read
Revises: v3330_user_notes
Create Date: 2026-11-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3331_correspondence_letter_read"
down_revision = "v3330_user_notes"
branch_labels = None
depends_on = None

_TABLE = "oe_correspondence_letter_read"


def _has_table(name: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return name in insp.get_table_names()


def upgrade() -> None:
    if _has_table(_TABLE):
        return
    op.create_table(
        _TABLE,
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "letter_id",
            sa.String(length=36),
            sa.ForeignKey("oe_correspondence_correspondence.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("oe_users_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("letter_id", "user_id", name="uq_oe_correspondence_letter_read_letter_user"),
    )
    op.create_index("ix_oe_correspondence_letter_read_letter_id", _TABLE, ["letter_id"])
    op.create_index("ix_oe_correspondence_letter_read_user_id", _TABLE, ["user_id"])


def downgrade() -> None:
    if _has_table(_TABLE):
        op.drop_table(_TABLE)
