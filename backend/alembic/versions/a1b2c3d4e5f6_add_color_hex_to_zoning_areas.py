"""add color_hex to zoning_areas

Revision ID: a1b2c3d4e5f6
Revises: 8488da4fce29
Create Date: 2026-05-11 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = 'a1b2c3d4e5f6'
down_revision = '8488da4fce29'
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa_inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns("zoning_areas")]
    if "color_hex" not in cols:
        op.add_column(
            "zoning_areas",
            sa.Column("color_hex", sa.String(7), nullable=True),
        )


def downgrade() -> None:
    inspector = sa_inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns("zoning_areas")]
    if "color_hex" in cols:
        op.drop_column("zoning_areas", "color_hex")