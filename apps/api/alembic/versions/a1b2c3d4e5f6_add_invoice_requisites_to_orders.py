"""Add invoice requisites file fields to orders

Revision ID: a1b2c3d4e5f6
Revises: d12f4a6b9c33
Create Date: 2026-03-07 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d12f4a6b9c33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return False
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    return column_name in existing_columns


def upgrade() -> None:
    if not _has_column("orders", "invoice_requisites_file_url"):
        op.add_column(
            "orders",
            sa.Column(
                "invoice_requisites_file_url", sa.String(length=500), nullable=True
            ),
        )
    if not _has_column("orders", "invoice_requisites_file_name"):
        op.add_column(
            "orders",
            sa.Column(
                "invoice_requisites_file_name", sa.String(length=255), nullable=True
            ),
        )


def downgrade() -> None:
    if _has_column("orders", "invoice_requisites_file_name"):
        op.drop_column("orders", "invoice_requisites_file_name")
    if _has_column("orders", "invoice_requisites_file_url"):
        op.drop_column("orders", "invoice_requisites_file_url")
