"""add pathology report fields

Revision ID: 7c2e1d9a5b44
Revises: 6f1b2a9d4c3e
Create Date: 2026-04-08 23:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c2e1d9a5b44"
down_revision: Union[str, Sequence[str], None] = "6f1b2a9d4c3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def has_fk(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return constraint_name in {
        foreign_key["name"]
        for foreign_key in inspector.get_foreign_keys(table_name)
        if foreign_key.get("name")
    }


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not has_column(inspector, "clinical_cases", "pathologist_user_id"):
        op.add_column("clinical_cases", sa.Column("pathologist_user_id", sa.Integer(), nullable=True))
    if not has_column(inspector, "clinical_cases", "pathology_diagnosis"):
        op.add_column("clinical_cases", sa.Column("pathology_diagnosis", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "pathology_report"):
        op.add_column("clinical_cases", sa.Column("pathology_report", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "pathology_reported_at"):
        op.add_column("clinical_cases", sa.Column("pathology_reported_at", sa.DateTime(), nullable=True))

    inspector = sa.inspect(bind)
    index_name = op.f("ix_clinical_cases_pathologist_user_id")
    if has_column(inspector, "clinical_cases", "pathologist_user_id"):
        if not has_index(inspector, "clinical_cases", index_name):
            op.create_index(index_name, "clinical_cases", ["pathologist_user_id"], unique=False)
        if not has_fk(inspector, "clinical_cases", "fk_clinical_cases_pathologist_user_id_users"):
            op.create_foreign_key(
                "fk_clinical_cases_pathologist_user_id_users",
                "clinical_cases",
                "users",
                ["pathologist_user_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    index_name = op.f("ix_clinical_cases_pathologist_user_id")

    if has_fk(inspector, "clinical_cases", "fk_clinical_cases_pathologist_user_id_users"):
        op.drop_constraint("fk_clinical_cases_pathologist_user_id_users", "clinical_cases", type_="foreignkey")
    if has_index(inspector, "clinical_cases", index_name):
        op.drop_index(index_name, table_name="clinical_cases")
    if has_column(inspector, "clinical_cases", "pathology_reported_at"):
        op.drop_column("clinical_cases", "pathology_reported_at")
    if has_column(inspector, "clinical_cases", "pathology_report"):
        op.drop_column("clinical_cases", "pathology_report")
    if has_column(inspector, "clinical_cases", "pathology_diagnosis"):
        op.drop_column("clinical_cases", "pathology_diagnosis")
    if has_column(inspector, "clinical_cases", "pathologist_user_id"):
        op.drop_column("clinical_cases", "pathologist_user_id")
