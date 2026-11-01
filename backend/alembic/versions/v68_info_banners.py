"""Info banner table (per page switch and text of the blue help banner). Safe to rerun.

Revision ID: v68_info_banners
Revises: v67_guide_overrides
"""

import sqlalchemy as sa
from alembic import op

revision = "v68_info_banners"
down_revision = "v67_guide_overrides"
branch_labels = None
depends_on = None

_TABLE = "oe_info_banner"


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table(_TABLE):
        return
    op.create_table(
        _TABLE,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("page_key", sa.String(128), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("text", sa.Text(), nullable=True),
        sa.UniqueConstraint("page_key", name="uq_info_banner_page_key"),
    )
    op.create_index("ix_oe_info_banner_page_key", _TABLE, ["page_key"])


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table(_TABLE):
        op.drop_table(_TABLE)
