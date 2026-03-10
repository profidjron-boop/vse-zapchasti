"""Add payment flow fields for service requests and orders

Revision ID: a6f9c8d2e4b1
Revises: 9c7e5a4b2d11
Create Date: 2026-03-10 18:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a6f9c8d2e4b1"
down_revision: Union[str, Sequence[str], None] = "9c7e5a4b2d11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    bind = op.get_bind()
    return sa.inspect(bind)


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    existing_columns = {column["name"] for column in _inspector().get_columns(table_name)}
    return column_name in existing_columns


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    existing_indexes = {index["name"] for index in _inspector().get_indexes(table_name)}
    return index_name in existing_indexes


def _add_payment_columns(table_name: str) -> None:
    if not _has_column(table_name, "payment_status"):
        op.add_column(
            table_name,
            sa.Column(
                "payment_status",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'not_required'"),
            ),
        )
    if not _has_column(table_name, "payment_required"):
        op.add_column(
            table_name,
            sa.Column(
                "payment_required",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if not _has_column(table_name, "payment_amount"):
        op.add_column(table_name, sa.Column("payment_amount", sa.Float(), nullable=True))
    if not _has_column(table_name, "payment_currency"):
        op.add_column(
            table_name,
            sa.Column(
                "payment_currency",
                sa.String(length=10),
                nullable=False,
                server_default=sa.text("'RUB'"),
            ),
        )
    if not _has_column(table_name, "payment_provider"):
        op.add_column(
            table_name, sa.Column("payment_provider", sa.String(length=100), nullable=True)
        )
    if not _has_column(table_name, "payment_reference"):
        op.add_column(
            table_name, sa.Column("payment_reference", sa.String(length=255), nullable=True)
        )
    if not _has_column(table_name, "payment_error"):
        op.add_column(table_name, sa.Column("payment_error", sa.Text(), nullable=True))
    if not _has_column(table_name, "payment_updated_at"):
        op.add_column(
            table_name, sa.Column("payment_updated_at", sa.DateTime(), nullable=True)
        )


def _drop_payment_columns(table_name: str) -> None:
    for column_name in [
        "payment_updated_at",
        "payment_error",
        "payment_reference",
        "payment_provider",
        "payment_currency",
        "payment_amount",
        "payment_required",
        "payment_status",
    ]:
        if _has_column(table_name, column_name):
            op.drop_column(table_name, column_name)


def upgrade() -> None:
    """Upgrade schema."""
    _add_payment_columns("service_requests")
    _add_payment_columns("orders")

    if not _has_index("service_requests", "ix_service_requests_payment_reference"):
        op.create_index(
            "ix_service_requests_payment_reference",
            "service_requests",
            ["payment_reference"],
            unique=False,
        )
    if not _has_index("orders", "ix_orders_payment_reference"):
        op.create_index(
            "ix_orders_payment_reference",
            "orders",
            ["payment_reference"],
            unique=False,
        )

    op.alter_column("service_requests", "payment_status", server_default=None)
    op.alter_column("service_requests", "payment_required", server_default=None)
    op.alter_column("service_requests", "payment_currency", server_default=None)
    op.alter_column("orders", "payment_status", server_default=None)
    op.alter_column("orders", "payment_required", server_default=None)
    op.alter_column("orders", "payment_currency", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    if _has_index("orders", "ix_orders_payment_reference"):
        op.drop_index("ix_orders_payment_reference", table_name="orders")
    if _has_index("service_requests", "ix_service_requests_payment_reference"):
        op.drop_index(
            "ix_service_requests_payment_reference", table_name="service_requests"
        )

    _drop_payment_columns("orders")
    _drop_payment_columns("service_requests")
