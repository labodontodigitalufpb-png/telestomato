"""create teleconsultation answers

Revision ID: 91d6a5b8c2f1
Revises: 54e72c98df13
Create Date: 2026-04-08 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "91d6a5b8c2f1"
down_revision: Union[str, Sequence[str], None] = "54e72c98df13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teleconsultation_answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("consultant_user_id", sa.Integer(), nullable=False),
        sa.Column("diagnostic_opinion", sa.Text(), nullable=False),
        sa.Column("conduct", sa.Text(), nullable=False),
        sa.Column("care_coordination", sa.Text(), nullable=False),
        sa.Column("references", sa.Text(), nullable=True),
        sa.Column("answered_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["clinical_cases.id"]),
        sa.ForeignKeyConstraint(["consultant_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_teleconsultation_answers_id"),
        "teleconsultation_answers",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_teleconsultation_answers_case_id"),
        "teleconsultation_answers",
        ["case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_teleconsultation_answers_consultant_user_id"),
        "teleconsultation_answers",
        ["consultant_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_teleconsultation_answers_consultant_user_id"),
        table_name="teleconsultation_answers",
    )
    op.drop_index(
        op.f("ix_teleconsultation_answers_case_id"),
        table_name="teleconsultation_answers",
    )
    op.drop_index(
        op.f("ix_teleconsultation_answers_id"),
        table_name="teleconsultation_answers",
    )
    op.drop_table("teleconsultation_answers")
