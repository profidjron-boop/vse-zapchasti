"""Add orders and order_items tables

Revision ID: f3a19c2e7b44
Revises: 1e6d6fcf131e
Create Date: 2026-03-05 19:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f3a19c2e7b44"
down_revision: Union[str, Sequence[str], None] = "1e6d6fcf131e"
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

    if not inspector.has_table("orders"):
        op.create_table(
            "orders",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("uuid", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False),
            sa.Column("source", sa.String(length=50), nullable=False),
            sa.Column("customer_name", sa.String(length=255), nullable=True),
            sa.Column("customer_phone", sa.String(length=50), nullable=False),
            sa.Column("customer_email", sa.String(length=255), nullable=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("delivery_method", sa.String(length=50), nullable=True),
            sa.Column("payment_method", sa.String(length=50), nullable=True),
            sa.Column("legal_entity_name", sa.String(length=255), nullable=True),
            sa.Column("legal_entity_inn", sa.String(length=20), nullable=True),
            sa.Column("ip_address", sa.String(length=50), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("consent_given", sa.Boolean(), nullable=True),
            sa.Column("consent_version", sa.String(length=50), nullable=True),
            sa.Column("consent_text", sa.Text(), nullable=True),
            sa.Column("consent_at", sa.DateTime(), nullable=True),
            sa.Column("manager_comment", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_index("orders", op.f("ix_orders_id"), ["id"])
    _ensure_index("orders", op.f("ix_orders_uuid"), ["uuid"], unique=True)
    _ensure_index("orders", op.f("ix_orders_customer_phone"), ["customer_phone"])

    inspector = sa.inspect(bind)
    if not inspector.has_table("order_items"):
        op.create_table(
            "order_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=True),
            sa.Column("product_sku", sa.String(length=100), nullable=True),
            sa.Column("product_name", sa.String(length=500), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("unit_price", sa.Float(), nullable=True),
            sa.Column("line_total", sa.Float(), nullable=True),
            sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_index("order_items", op.f("ix_order_items_id"), ["id"])
    _ensure_index("order_items", op.f("ix_order_items_order_id"), ["order_id"])
    _ensure_index("order_items", op.f("ix_order_items_product_sku"), ["product_sku"])


def downgrade() -> None:
    """Downgrade schema."""
    _drop_index_if_exists("order_items", op.f("ix_order_items_product_sku"))
    _drop_index_if_exists("order_items", op.f("ix_order_items_order_id"))
    _drop_index_if_exists("order_items", op.f("ix_order_items_id"))

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("order_items"):
        op.drop_table("order_items")

    _drop_index_if_exists("orders", op.f("ix_orders_customer_phone"))
    _drop_index_if_exists("orders", op.f("ix_orders_uuid"))
    _drop_index_if_exists("orders", op.f("ix_orders_id"))

    inspector = sa.inspect(bind)
    if inspector.has_table("orders"):
        op.drop_table("orders")
