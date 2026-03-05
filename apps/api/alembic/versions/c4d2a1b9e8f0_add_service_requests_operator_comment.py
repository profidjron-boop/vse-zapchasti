"""add service_requests.operator_comment (no-op)

Revision ID: c4d2a1b9e8f0
Revises: 7a8a6d21d5f2
Create Date: 2026-03-05

NOTE:
This migration became redundant because another branch migration
(6c1f229dd1d7_add_operator_comment_to_service_requests) already adds the
service_requests.operator_comment column.

To keep the migration graph stable (after merge), we keep this revision as a no-op.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "c4d2a1b9e8f0"
down_revision: Union[str, Sequence[str], None] = "7a8a6d21d5f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # no-op (superseded by 6c1f229dd1d7)
    return


def downgrade() -> None:
    # no-op
    return
