"""Add site_content table

Revision ID: 29581caf54af
Revises: 074c5780a9da
Create Date: 2026-03-04 21:56:56.335003

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "29581caf54af"
down_revision: Union[str, Sequence[str], None] = "074c5780a9da"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "site_content",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_site_content_id"), "site_content", ["id"], unique=False)
    op.create_index(op.f("ix_site_content_key"), "site_content", ["key"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_site_content_key"), table_name="site_content")
    op.drop_index(op.f("ix_site_content_id"), table_name="site_content")
    op.drop_table("site_content")
