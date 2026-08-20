"""add severity to the hazard and zoning area

Revision ID: bb061d370a94
Revises: b2c3d4e5f6a7
Create Date: 2026-05-18 20:18:12.851597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'bb061d370a94'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hazard_areas', sa.Column('severity', sa.Integer(), nullable=True))
    op.add_column('zoning_areas', sa.Column('severity', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('hazard_areas', 'severity')
    op.drop_column('zoning_areas', 'severity')
