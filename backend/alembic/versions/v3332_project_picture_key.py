# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Project picture - nullable ``picture_key`` on ``oe_projects_project``.

Stores the object-store key of the project avatar (``projects/<id>/picture.<ext>``).
NULL means no picture; the UI then shows initials. Additive: one nullable column.
Inspector-guarded, so a re-run or a DB the runtime already auto-created is a no-op.

Revision ID: v3332_project_picture_key
Revises: v3331_correspondence_letter_read
Create Date: 2026-11-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3332_project_picture_key"
down_revision = "v3331_correspondence_letter_read"
branch_labels = None
depends_on = None

_TABLE = "oe_projects_project"
_COLUMN = "picture_key"


def _has_column() -> bool:
    insp = sa.inspect(op.get_bind())
    return _COLUMN in {c["name"] for c in insp.get_columns(_TABLE)}


def upgrade() -> None:
    if _has_column():
        return
    op.add_column(_TABLE, sa.Column(_COLUMN, sa.String(length=500), nullable=True))


def downgrade() -> None:
    if not _has_column():
        return
    with op.batch_alter_table(_TABLE) as batch:
        batch.drop_column(_COLUMN)
