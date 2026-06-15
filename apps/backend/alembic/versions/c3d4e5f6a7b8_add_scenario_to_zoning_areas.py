"""add scenario to zoning areas

Revision ID: c3d4e5f6a7b8
Revises: bb061d370a94
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'bb061d370a94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c["name"] for c in inspector.get_columns("zoning_areas")]

    if "scenario" not in columns:
        op.add_column("zoning_areas", sa.Column("scenario", sa.String(50), nullable=True))
    if "scenario_type" not in columns:
        op.add_column("zoning_areas", sa.Column("scenario_type", sa.String(20), nullable=True))

    indexes = [i["name"] for i in inspector.get_indexes("zoning_areas")]
    if "idx_zoning_areas_city_scenario" not in indexes:
        op.create_index("idx_zoning_areas_city_scenario", "zoning_areas", ["city_id", "scenario"])


def downgrade() -> None:
    op.drop_index("idx_zoning_areas_city_scenario", table_name="zoning_areas")
    op.drop_column("zoning_areas", "scenario_type")
    op.drop_column("zoning_areas", "scenario")