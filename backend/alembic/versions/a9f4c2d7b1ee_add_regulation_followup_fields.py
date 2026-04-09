"""add regulation followup fields

Revision ID: a9f4c2d7b1ee
Revises: 7c2e1d9a5b44
Create Date: 2026-04-09 11:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9f4c2d7b1ee"
down_revision: Union[str, Sequence[str], None] = "7c2e1d9a5b44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not has_column(inspector, "clinical_cases", "microscopic_report_date"):
        op.add_column("clinical_cases", sa.Column("microscopic_report_date", sa.Date(), nullable=True))
    if not has_column(inspector, "clinical_cases", "followup_1m_head_neck_seen"):
        op.add_column("clinical_cases", sa.Column("followup_1m_head_neck_seen", sa.Boolean(), nullable=True))
    if not has_column(inspector, "clinical_cases", "followup_3m_initial_treatment_done"):
        op.add_column("clinical_cases", sa.Column("followup_3m_initial_treatment_done", sa.Boolean(), nullable=True))
    if not has_column(inspector, "clinical_cases", "followup_6m_status"):
        op.add_column("clinical_cases", sa.Column("followup_6m_status", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "followup_main_barriers"):
        op.add_column("clinical_cases", sa.Column("followup_main_barriers", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for column_name in [
        "followup_main_barriers",
        "followup_6m_status",
        "followup_3m_initial_treatment_done",
        "followup_1m_head_neck_seen",
        "microscopic_report_date",
    ]:
        inspector = sa.inspect(bind)
        if has_column(inspector, "clinical_cases", column_name):
            op.drop_column("clinical_cases", column_name)
