"""Add service catalog items table

Revision ID: b9f16e3f87aa
Revises: f3a19c2e7b44
Create Date: 2026-03-05 23:58:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b9f16e3f87aa"
down_revision: Union[str, Sequence[str], None] = "f3a19c2e7b44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ensure_index(
    table_name: str, index_name: str, columns: list[str], *, unique: bool = False
) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return
    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name not in existing_indexes:
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index_if_exists(table_name: str, index_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return
    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name in existing_indexes:
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("service_catalog_items"):
        op.create_table(
            "service_catalog_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column(
                "vehicle_type",
                sa.String(length=20),
                nullable=False,
                server_default="passenger",
            ),
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            sa.Column("price", sa.Float(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "is_active", sa.Boolean(), nullable=False, server_default=sa.true()
            ),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_index("service_catalog_items", op.f("ix_service_catalog_items_id"), ["id"])
    _ensure_index(
        "service_catalog_items",
        op.f("ix_service_catalog_items_vehicle_type"),
        ["vehicle_type"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    _drop_index_if_exists(
        "service_catalog_items", op.f("ix_service_catalog_items_vehicle_type")
    )
    _drop_index_if_exists("service_catalog_items", op.f("ix_service_catalog_items_id"))

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("service_catalog_items"):
        op.drop_table("service_catalog_items")
