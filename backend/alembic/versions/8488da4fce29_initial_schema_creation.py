"""initial schema creation

Revision ID: 8488da4fce29
Revises:
Create Date: 2026-05-11 19:26:59.611934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8488da4fce29'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are created via Base.metadata.create_all() on app startup.
    # This migration exists only to mark the baseline in Alembic's version history.
    pass


def downgrade() -> None:
    # Tiger geocoder tables are managed by the PostGIS extension — not dropped here.
    pass
