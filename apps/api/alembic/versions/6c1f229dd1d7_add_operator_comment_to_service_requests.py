"""Add operator_comment to service_requests

Revision ID: 6c1f229dd1d7
Revises: 7a8a6d21d5f2
Create Date: 2026-03-05 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6c1f229dd1d7"
down_revision: Union[str, Sequence[str], None] = "7a8a6d21d5f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("service_requests", sa.Column("operator_comment", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("service_requests", "operator_comment")
