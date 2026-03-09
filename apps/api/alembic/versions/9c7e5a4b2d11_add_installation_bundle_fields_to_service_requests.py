"""Add installation bundle fields to service_requests

Revision ID: 9c7e5a4b2d11
Revises: f6e2c1a9b7d3
Create Date: 2026-03-09 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c7e5a4b2d11"
down_revision: Union[str, Sequence[str], None] = "f6e2c1a9b7d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_column(table_name: str, column_name: str):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return None
    for column in inspector.get_columns(table_name):
        if column.get("name") == column_name:
            return column
    return None


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return False
    for index in inspector.get_indexes(table_name):
        if index.get("name") == index_name:
            return True
    return False


def upgrade() -> None:
    if _get_column("service_requests", "install_with_part") is None:
        op.add_column(
            "service_requests",
            sa.Column("install_with_part", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    if _get_column("service_requests", "requested_product_sku") is None:
        op.add_column("service_requests", sa.Column("requested_product_sku", sa.String(length=100), nullable=True))

    if _get_column("service_requests", "requested_product_name") is None:
        op.add_column("service_requests", sa.Column("requested_product_name", sa.String(length=500), nullable=True))

    if _get_column("service_requests", "estimated_bundle_total") is None:
        op.add_column("service_requests", sa.Column("estimated_bundle_total", sa.Float(), nullable=True))

    if not _has_index("service_requests", "ix_service_requests_requested_product_sku"):
        op.create_index(
            "ix_service_requests_requested_product_sku",
            "service_requests",
            ["requested_product_sku"],
            unique=False,
        )


def downgrade() -> None:
    if _has_index("service_requests", "ix_service_requests_requested_product_sku"):
        op.drop_index("ix_service_requests_requested_product_sku", table_name="service_requests")

    if _get_column("service_requests", "estimated_bundle_total") is not None:
        op.drop_column("service_requests", "estimated_bundle_total")

    if _get_column("service_requests", "requested_product_name") is not None:
        op.drop_column("service_requests", "requested_product_name")

    if _get_column("service_requests", "requested_product_sku") is not None:
        op.drop_column("service_requests", "requested_product_sku")

    if _get_column("service_requests", "install_with_part") is not None:
        op.drop_column("service_requests", "install_with_part")
