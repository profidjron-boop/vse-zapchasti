"""merge heads after service_requests operator_comment

Revision ID: 1e6d6fcf131e
Revises: 5d2f4d8f7f1a, c4d2a1b9e8f0
Create Date: 2026-03-05 18:39:40.657373

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "1e6d6fcf131e"
down_revision: Union[str, Sequence[str], None] = ("5d2f4d8f7f1a", "c4d2a1b9e8f0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
