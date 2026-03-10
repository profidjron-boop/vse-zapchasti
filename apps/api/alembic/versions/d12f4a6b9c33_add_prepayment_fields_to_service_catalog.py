"""Add prepayment fields to service catalog items

Revision ID: d12f4a6b9c33
Revises: b9f16e3f87aa
Create Date: 2026-03-06 01:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d12f4a6b9c33"
down_revision: Union[str, Sequence[str], None] = "b9f16e3f87aa"
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
    """Upgrade schema."""
    if not _has_column("service_catalog_items", "prepayment_required"):
        op.add_column(
            "service_catalog_items",
            sa.Column(
                "prepayment_required",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    if not _has_column("service_catalog_items", "prepayment_amount"):
        op.add_column(
            "service_catalog_items",
            sa.Column("prepayment_amount", sa.Float(), nullable=True),
        )

    op.alter_column("service_catalog_items", "prepayment_required", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    if _has_column("service_catalog_items", "prepayment_amount"):
        op.drop_column("service_catalog_items", "prepayment_amount")

    if _has_column("service_catalog_items", "prepayment_required"):
        op.drop_column("service_catalog_items", "prepayment_required")
