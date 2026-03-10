"""Add vehicle_engine and make service request name optional

Revision ID: f6e2c1a9b7d3
Revises: a1b2c3d4e5f6
Create Date: 2026-03-09 21:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6e2c1a9b7d3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_column(table_name: str, column_name: str):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return None
    for column in inspector.get_columns(table_name):
        if column.get("name") == column_name:
            return column
    return None


def upgrade() -> None:
    if _get_column("service_requests", "vehicle_engine") is None:
        op.add_column(
            "service_requests",
            sa.Column("vehicle_engine", sa.String(length=100), nullable=True),
        )

    name_column = _get_column("service_requests", "name")
    if name_column is not None and not bool(name_column.get("nullable", False)):
        with op.batch_alter_table("service_requests") as batch_op:
            batch_op.alter_column(
                "name",
                existing_type=sa.String(length=255),
                nullable=True,
            )


def downgrade() -> None:
    name_column = _get_column("service_requests", "name")
    if name_column is not None and bool(name_column.get("nullable", True)):
        with op.batch_alter_table("service_requests") as batch_op:
            batch_op.alter_column(
                "name",
                existing_type=sa.String(length=255),
                nullable=False,
            )

    if _get_column("service_requests", "vehicle_engine") is not None:
        op.drop_column("service_requests", "vehicle_engine")
