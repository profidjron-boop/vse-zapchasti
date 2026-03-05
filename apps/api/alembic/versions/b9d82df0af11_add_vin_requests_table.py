"""Add vin_requests table

Revision ID: b9d82df0af11
Revises: 6c1f229dd1d7
Create Date: 2026-03-05 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b9d82df0af11"
down_revision: Union[str, Sequence[str], None] = "6c1f229dd1d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "vin_requests"
    index_id = op.f("ix_vin_requests_id")
    index_uuid = op.f("ix_vin_requests_uuid")

    if inspector.has_table(table_name):
        existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        if index_id not in existing_indexes:
            op.create_index(index_id, table_name, ["id"], unique=False)
        if index_uuid not in existing_indexes:
            op.create_index(index_uuid, table_name, ["uuid"], unique=True)
        return

    op.create_table(
        table_name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("vin", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("consent_given", sa.Boolean(), nullable=True),
        sa.Column("consent_version", sa.String(length=50), nullable=True),
        sa.Column("consent_text", sa.Text(), nullable=True),
        sa.Column("consent_at", sa.DateTime(), nullable=True),
        sa.Column("operator_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(index_id, table_name, ["id"], unique=False)
    op.create_index(index_uuid, table_name, ["uuid"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "vin_requests"
    index_id = op.f("ix_vin_requests_id")
    index_uuid = op.f("ix_vin_requests_uuid")

    if not inspector.has_table(table_name):
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_uuid in existing_indexes:
        op.drop_index(index_uuid, table_name=table_name)
    if index_id in existing_indexes:
        op.drop_index(index_id, table_name=table_name)
    op.drop_table(table_name)
