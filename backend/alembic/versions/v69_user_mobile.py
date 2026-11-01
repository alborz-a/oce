"""Mobile number on the user row (login by mobile + password). Safe to rerun.

Nullable, indexed, NOT unique on purpose: login refuses an ambiguous number
(two users with the same mobile) instead of the database refusing the import.

Revision ID: v69_user_mobile
Revises: v68_info_banners
"""

import sqlalchemy as sa
from alembic import op

revision = "v69_user_mobile"
down_revision = "v68_info_banners"
branch_labels = None
depends_on = None

_TABLE = "oe_users_user"
_COLUMN = "mobile"
_INDEX = "ix_oe_users_user_mobile"


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table(_TABLE):
        return
    if _COLUMN not in {c["name"] for c in insp.get_columns(_TABLE)}:
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.String(20), nullable=True))
    insp = sa.inspect(op.get_bind())
    if _INDEX not in {i["name"] for i in insp.get_indexes(_TABLE)}:
        op.create_index(_INDEX, _TABLE, [_COLUMN])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table(_TABLE):
        return
    if _INDEX in {i["name"] for i in insp.get_indexes(_TABLE)}:
        op.drop_index(_INDEX, table_name=_TABLE)
    if _COLUMN in {c["name"] for c in insp.get_columns(_TABLE)}:
        op.drop_column(_TABLE, _COLUMN)
