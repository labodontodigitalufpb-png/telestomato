"""add followup 1y status for regulation

Revision ID: d2b7f3a11c5e
Revises: a9f4c2d7b1ee
Create Date: 2026-04-10 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2b7f3a11c5e"
down_revision: Union[str, Sequence[str], None] = "a9f4c2d7b1ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not has_column(inspector, "clinical_cases", "followup_1y_status"):
        op.add_column("clinical_cases", sa.Column("followup_1y_status", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if has_column(inspector, "clinical_cases", "followup_1y_status"):
        op.drop_column("clinical_cases", "followup_1y_status")
