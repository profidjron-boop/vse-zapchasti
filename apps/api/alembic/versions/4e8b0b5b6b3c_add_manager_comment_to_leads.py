"""Add manager_comment to leads

Revision ID: 4e8b0b5b6b3c
Revises: b9d82df0af11
Create Date: 2026-03-05 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4e8b0b5b6b3c"
down_revision: Union[str, Sequence[str], None] = "b9d82df0af11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("leads", sa.Column("manager_comment", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("leads", "manager_comment")
