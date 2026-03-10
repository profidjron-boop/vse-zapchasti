"""Add import_runs table

Revision ID: 5d2f4d8f7f1a
Revises: 4e8b0b5b6b3c
Create Date: 2026-03-05 16:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "5d2f4d8f7f1a"
down_revision: Union[str, Sequence[str], None] = "4e8b0b5b6b3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "import_runs"
    index_id = op.f("ix_import_runs_id")

    if inspector.has_table(table_name):
        existing_indexes = {
            index["name"] for index in inspector.get_indexes(table_name)
        }
        if index_id not in existing_indexes:
            op.create_index(index_id, table_name, ["id"], unique=False)
        return

    op.create_table(
        table_name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("errors", sa.JSON(), nullable=True),
        sa.Column("snapshot_data", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("previous_successful_run_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["previous_successful_run_id"], ["import_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(index_id, table_name, ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "import_runs"
    index_id = op.f("ix_import_runs_id")

    if not inspector.has_table(table_name):
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_id in existing_indexes:
        op.drop_index(index_id, table_name=table_name)
    op.drop_table(table_name)
