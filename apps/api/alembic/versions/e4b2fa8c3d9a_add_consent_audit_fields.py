"""Add consent audit fields to leads and service_requests

Revision ID: e4b2fa8c3d9a
Revises: 29581caf54af
Create Date: 2026-03-05 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e4b2fa8c3d9a"
down_revision: Union[str, Sequence[str], None] = "29581caf54af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("leads", sa.Column("consent_text", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("consent_at", sa.DateTime(), nullable=True))
    op.add_column(
        "service_requests", sa.Column("consent_text", sa.Text(), nullable=True)
    )
    op.add_column(
        "service_requests", sa.Column("consent_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("service_requests", "consent_at")
    op.drop_column("service_requests", "consent_text")
    op.drop_column("leads", "consent_at")
    op.drop_column("leads", "consent_text")
