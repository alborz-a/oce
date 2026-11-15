"""Per-project-role module switches (RSD-0.50 H1). Safe to rerun.

One row per project role (member, project_manager, viewer) holding the list of
modules switched off for that role. A missing row means every module is on.

Revision ID: v70_project_role_modules
Revises: v69_user_mobile
"""

import sqlalchemy as sa
from alembic import op

revision = "v70_project_role_modules"
down_revision = "v69_user_mobile"
branch_labels = None
depends_on = None

_TABLE = "oe_project_role_modules"


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if insp.has_table(_TABLE):
        return
    op.create_table(
        _TABLE,
        sa.Column("role", sa.String(32), primary_key=True),
        sa.Column("disabled_modules", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if insp.has_table(_TABLE):
        op.drop_table(_TABLE)
