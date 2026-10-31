"""Team chat tables (company, project, group and direct rooms).

New tables, so ``create_all`` also brings them to running installs; the revision keeps an Alembic-built database in
step. Each table is created only when missing.

Revision ID: v3325_team_chat
Revises: v3324_buyer_selection_currency
"""

import sqlalchemy as sa
from alembic import op

revision = "v3325_team_chat"
down_revision = "v65_po_invoice_tolerance"
branch_labels = None
depends_on = None


def _ts():
    return [
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    ]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table("oe_team_chat_room"):
        op.create_table(
            "oe_team_chat_room", *_ts(),
            sa.Column("kind", sa.String(20), nullable=False),
            sa.Column("project_id", sa.String(36), sa.ForeignKey("oe_projects_project.id", ondelete="CASCADE")),
            sa.Column("name", sa.String(255), nullable=False, server_default=""),
            sa.Column("created_by", sa.String(36), nullable=False, server_default=""),
            sa.Column("dm_key", sa.String(80)),
            sa.Column("source_id", sa.String(200)),
            sa.Column("metadata", sa.JSON, nullable=False, server_default="{}"),
            sa.UniqueConstraint("project_id", name="uq_oe_team_chat_room_project"),
            sa.UniqueConstraint("source_id", name="uq_oe_team_chat_room_source"),
            sa.UniqueConstraint("dm_key", name="uq_oe_team_chat_room_dm_key"),
        )
        op.create_index("ix_oe_team_chat_room_kind", "oe_team_chat_room", ["kind"])
    if not insp.has_table("oe_team_chat_member"):
        op.create_table(
            "oe_team_chat_member", *_ts(),
            sa.Column("room_id", sa.String(36), sa.ForeignKey("oe_team_chat_room.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("role", sa.String(20), nullable=False, server_default="member"),
            sa.Column("last_read_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("room_id", "user_id", name="uq_oe_team_chat_member"),
        )
        op.create_index("ix_oe_team_chat_member_room_id", "oe_team_chat_member", ["room_id"])
        op.create_index("ix_oe_team_chat_member_user_id", "oe_team_chat_member", ["user_id"])
    if not insp.has_table("oe_team_chat_message"):
        op.create_table(
            "oe_team_chat_message", *_ts(),
            sa.Column("room_id", sa.String(36), sa.ForeignKey("oe_team_chat_room.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_id", sa.String(36)),
            sa.Column("text", sa.Text, nullable=False, server_default=""),
            sa.Column("reply_to_id", sa.String(36)),
            sa.Column("document_ids", sa.JSON, nullable=False, server_default="[]"),
            sa.Column("edited_at", sa.DateTime(timezone=True)),
            sa.Column("source_id", sa.String(200)),
            sa.Column("metadata", sa.JSON, nullable=False, server_default="{}"),
            sa.UniqueConstraint("source_id", name="uq_oe_team_chat_message_source"),
        )
        op.create_index("ix_oe_team_chat_message_room_created", "oe_team_chat_message", ["room_id", "created_at"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for t in ("oe_team_chat_message", "oe_team_chat_member", "oe_team_chat_room"):
        if insp.has_table(t):
            op.drop_table(t)
