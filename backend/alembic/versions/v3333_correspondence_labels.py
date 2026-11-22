# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Per-user mailbox labels.

Replaces the workspace-wide unique ``name`` on ``oe_correspondence_label``
with a unique pair ``(created_by, name)`` so each user owns their own labels.

Postgres only: the old unique is dropped by its reflected name and the new
pair constraint is created. SQLite cannot drop an unnamed inline UNIQUE in
place, so on SQLite this migration is a no-op (tests build schema from models
via ``create_all``).

Revision ID: v3333_correspondence_labels
Revises: v3332_correspondence_mailbox
Create Date: 2026-11-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3333_correspondence_labels"
down_revision = "v3332_correspondence_mailbox"
branch_labels = None
depends_on = None

_LABEL = "oe_correspondence_label"
_NEW_UQ = "uq_oe_correspondence_label_owner_name"
_OLD_UQ = "uq_oe_correspondence_label_name"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    insp = sa.inspect(bind)
    names = {uc["name"] for uc in insp.get_unique_constraints(_LABEL) if uc.get("name")}
    for uc in insp.get_unique_constraints(_LABEL):
        if uc["column_names"] == ["name"] and uc.get("name"):
            op.drop_constraint(uc["name"], _LABEL, type_="unique")
    if _NEW_UQ not in names:
        op.create_unique_constraint(_NEW_UQ, _LABEL, ["created_by", "name"])


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.drop_constraint(_NEW_UQ, _LABEL, type_="unique")
    op.create_unique_constraint(_OLD_UQ, _LABEL, ["name"])
