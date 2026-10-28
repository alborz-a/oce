"""Profile picture path on the user row.

One nullable column, added only when missing, so a database the boot-time
column healer already touched upgrades cleanly. NULL means no picture; the
file itself lives under the app data dir, not in the database.

Revision ID: v66_user_avatar_path
Revises: v65_po_invoice_tolerance
"""

import sqlalchemy as sa
from alembic import op

revision = "v66_user_avatar_path"
down_revision = "v65_po_invoice_tolerance"
branch_labels = None
depends_on = None

_TABLE = "oe_users_user"
_COLUMN = "avatar_path"


def _existing(inspector) -> set[str] | None:
    if not inspector.has_table(_TABLE):
        return None
    return {c["name"] for c in inspector.get_columns(_TABLE)}


def upgrade() -> None:
    present = _existing(sa.inspect(op.get_bind()))
    if present is None:
        return
    if _COLUMN not in present:
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.String(255), nullable=True))


def downgrade() -> None:
    present = _existing(sa.inspect(op.get_bind()))
    if present is None:
        return
    if _COLUMN in present:
        op.drop_column(_TABLE, _COLUMN)
