# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Secretariat registration columns for mailbox letters.

Adds prefix, company-wide number, Jalali postfix, register type and
registration time to ``oe_correspondence_correspondence`` and a unique
constraint on the number, so one number is never issued twice.

Revision ID: v3335_correspondence_secretariat
Revises: v3334_project_picture_key
Create Date: 2026-11-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3335_correspondence_secretariat"
down_revision = "v3334_project_picture_key"
branch_labels = None
depends_on = None

_TABLE = "oe_correspondence_correspondence"
_UQ = "uq_oe_correspondence_secretariat_number"


def _column_names() -> set[str]:
    insp = sa.inspect(op.get_bind())
    return {c["name"] for c in insp.get_columns(_TABLE)}


def _unique_names() -> set[str]:
    insp = sa.inspect(op.get_bind())
    return {uc["name"] for uc in insp.get_unique_constraints(_TABLE) if uc.get("name")}


def upgrade() -> None:
    have = _column_names()
    with op.batch_alter_table(_TABLE) as batch:
        if "secretariat_prefix" not in have:
            batch.add_column(sa.Column("secretariat_prefix", sa.String(length=10), nullable=True))
        if "secretariat_number" not in have:
            batch.add_column(sa.Column("secretariat_number", sa.Integer(), nullable=True))
        if "secretariat_postfix" not in have:
            batch.add_column(sa.Column("secretariat_postfix", sa.String(length=3), nullable=True))
        if "secretariat_register_type" not in have:
            batch.add_column(sa.Column("secretariat_register_type", sa.Integer(), nullable=True))
        if "secretariat_registered_at" not in have:
            batch.add_column(sa.Column("secretariat_registered_at", sa.DateTime(timezone=True), nullable=True))
        if _UQ not in _unique_names():
            batch.create_unique_constraint(_UQ, ["secretariat_number"])


def downgrade() -> None:
    have = _column_names()
    with op.batch_alter_table(_TABLE) as batch:
        if _UQ in _unique_names():
            batch.drop_constraint(_UQ, type_="unique")
        for col in (
            "secretariat_registered_at",
            "secretariat_register_type",
            "secretariat_postfix",
            "secretariat_number",
            "secretariat_prefix",
        ):
            if col in have:
                batch.drop_column(col)
