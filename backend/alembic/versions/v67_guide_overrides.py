"""Guide overrides table (per module, role or user visibility and text of guides).

Revision ID: v67_guide_overrides
Revises: v66_user_avatar_path
"""

import sqlalchemy as sa
from alembic import op

revision = "v67_guide_overrides"
down_revision = "v66_user_avatar_path"
branch_labels = None
depends_on = None

_TABLE = "oe_guide_override"


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table(_TABLE):
        return
    op.create_table(
        _TABLE,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("module_key", sa.String(64), nullable=False),
        sa.Column("scope", sa.String(8), nullable=False),
        sa.Column("scope_value", sa.String(64), nullable=False, server_default=""),
        sa.Column("visible", sa.Boolean(), nullable=True),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.UniqueConstraint("module_key", "scope", "scope_value", name="uq_guide_override_key"),
    )
    op.create_index("ix_guide_override_module", _TABLE, ["module_key"])


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table(_TABLE):
        op.drop_table(_TABLE)
