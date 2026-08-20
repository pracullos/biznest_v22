"""replace username with full_name in users

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa_inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns("users")]

    if "full_name" not in cols:
        # Add full_name, backfill from email prefix, then make non-nullable
        op.add_column("users", sa.Column("full_name", sa.String(100), nullable=True))
        op.execute("UPDATE users SET full_name = split_part(email, '@', 1) WHERE full_name IS NULL")
        op.alter_column("users", "full_name", nullable=False)

    if "username" in cols:
        # Drop unique index before dropping column
        indexes = [idx["name"] for idx in inspector.get_indexes("users")]
        if "ix_users_username" in indexes:
            op.drop_index("ix_users_username", table_name="users")
        op.drop_column("users", "username")


def downgrade() -> None:
    inspector = sa_inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns("users")]

    if "username" not in cols:
        op.add_column("users", sa.Column("username", sa.String(50), nullable=True))
        op.execute("UPDATE users SET username = split_part(email, '@', 1)")
        op.alter_column("users", "username", nullable=False)
        op.create_index("ix_users_username", "users", ["username"], unique=True)

    if "full_name" in cols:
        op.drop_column("users", "full_name")