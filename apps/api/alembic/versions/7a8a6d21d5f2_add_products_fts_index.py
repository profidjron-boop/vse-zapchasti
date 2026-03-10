"""Add products FTS GIN index

Revision ID: 7a8a6d21d5f2
Revises: e4b2fa8c3d9a
Create Date: 2026-03-05 13:30:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a8a6d21d5f2"
down_revision: Union[str, Sequence[str], None] = "e4b2fa8c3d9a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_search_tsv
        ON products
        USING GIN (
            to_tsvector(
                'russian',
                coalesce(name, '') || ' ' ||
                coalesce(sku, '') || ' ' ||
                coalesce(oem, '') || ' ' ||
                coalesce(brand, '')
            )
        )
        """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_products_search_tsv")
