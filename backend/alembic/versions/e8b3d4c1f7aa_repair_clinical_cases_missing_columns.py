"""repair clinical_cases missing columns

Revision ID: e8b3d4c1f7aa
Revises: c4a6e8d2f991
Create Date: 2026-04-08 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8b3d4c1f7aa"
down_revision: Union[str, Sequence[str], None] = "c4a6e8d2f991"
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

    if not has_column(inspector, "clinical_cases", "lesion_topography"):
        op.add_column("clinical_cases", sa.Column("lesion_topography", sa.String(length=120), nullable=True))
        op.execute("UPDATE clinical_cases SET lesion_topography = '' WHERE lesion_topography IS NULL")
        op.alter_column("clinical_cases", "lesion_topography", existing_type=sa.String(length=120), nullable=False)

    if not has_column(inspector, "clinical_cases", "consultant_summary"):
        op.add_column("clinical_cases", sa.Column("consultant_summary", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "consultant_hypotheses"):
        op.add_column("clinical_cases", sa.Column("consultant_hypotheses", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "consultant_conduct"):
        op.add_column("clinical_cases", sa.Column("consultant_conduct", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "consultant_care_coordination"):
        op.add_column("clinical_cases", sa.Column("consultant_care_coordination", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "consultant_bibliography"):
        op.add_column("clinical_cases", sa.Column("consultant_bibliography", sa.Text(), nullable=True))
    if not has_column(inspector, "clinical_cases", "consultant_hypothesis"):
        op.add_column("clinical_cases", sa.Column("consultant_hypothesis", sa.String(length=200), nullable=True))

    if not has_column(inspector, "clinical_cases", "consultant_is_malignant"):
        op.add_column(
            "clinical_cases",
            sa.Column("consultant_is_malignant", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
        op.alter_column("clinical_cases", "consultant_is_malignant", server_default=None)

    if not has_column(inspector, "clinical_cases", "assigned_to_user_id"):
        op.add_column("clinical_cases", sa.Column("assigned_to_user_id", sa.Integer(), nullable=True))

    inspector = sa.inspect(bind)
    if has_column(inspector, "clinical_cases", "assigned_to_user_id"):
        if not has_index(inspector, "clinical_cases", op.f("ix_clinical_cases_assigned_to_user_id")):
            op.create_index(
                op.f("ix_clinical_cases_assigned_to_user_id"),
                "clinical_cases",
                ["assigned_to_user_id"],
                unique=False,
            )
        if not has_fk(inspector, "clinical_cases", "fk_clinical_cases_assigned_to_user_id_users"):
            op.create_foreign_key(
                "fk_clinical_cases_assigned_to_user_id_users",
                "clinical_cases",
                "users",
                ["assigned_to_user_id"],
                ["id"],
            )

    if not has_column(inspector, "clinical_cases", "submitted_at"):
        op.add_column("clinical_cases", sa.Column("submitted_at", sa.DateTime(), nullable=True))
    if not has_column(inspector, "clinical_cases", "assigned_at"):
        op.add_column("clinical_cases", sa.Column("assigned_at", sa.DateTime(), nullable=True))
    if not has_column(inspector, "clinical_cases", "answered_at"):
        op.add_column("clinical_cases", sa.Column("answered_at", sa.DateTime(), nullable=True))
    if not has_column(inspector, "clinical_cases", "closed_at"):
        op.add_column("clinical_cases", sa.Column("closed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if has_fk(inspector, "clinical_cases", "fk_clinical_cases_assigned_to_user_id_users"):
        op.drop_constraint("fk_clinical_cases_assigned_to_user_id_users", "clinical_cases", type_="foreignkey")
    if has_index(inspector, "clinical_cases", op.f("ix_clinical_cases_assigned_to_user_id")):
        op.drop_index(op.f("ix_clinical_cases_assigned_to_user_id"), table_name="clinical_cases")

    for column_name in [
        "closed_at",
        "answered_at",
        "assigned_at",
        "submitted_at",
        "assigned_to_user_id",
        "consultant_is_malignant",
        "consultant_hypothesis",
        "consultant_bibliography",
        "consultant_care_coordination",
        "consultant_conduct",
        "consultant_hypotheses",
        "consultant_summary",
        "lesion_topography",
    ]:
        inspector = sa.inspect(bind)
        if has_column(inspector, "clinical_cases", column_name):
            op.drop_column("clinical_cases", column_name)
