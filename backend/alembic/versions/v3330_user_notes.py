# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Personal notes - ``oe_notes_user_note``.

One row per note, owned by exactly one user (``owner_user_id`` FK to ``oe_users_user``, cascade delete).
GUID columns are VARCHAR(36) (the app.database.GUID TypeDecorator impl). Additive: no existing table is touched.
Inspector-guarded, so a re-run or a DB the runtime already auto-created is a no-op.

Revision ID: v3330_user_notes
Revises: v69_user_mobile
Create Date: 2026-11-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3330_user_notes"
down_revision = "v69_user_mobile"
branch_labels = None
depends_on = None

_TABLE = "oe_notes_user_note"


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
            "owner_user_id",
            sa.String(length=36),
            sa.ForeignKey("oe_users_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#fb0"),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_oe_notes_user_note_owner_user_id", _TABLE, ["owner_user_id"])
    op.create_index("ix_oe_notes_user_note_owner_pinned_updated", _TABLE, ["owner_user_id", "pinned", "updated_at"])


def downgrade() -> None:
    if _has_table(_TABLE):
        op.drop_table(_TABLE)
