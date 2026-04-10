"""make clinical_cases fields not null

Revision ID: 54e72c98df13
Revises: 4fe8197c21be
Create Date: 2026-02-10 17:47:59.100593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '54e72c98df13'
down_revision: Union[str, Sequence[str], None] = '4fe8197c21be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("clinical_cases", sa.Column("lesion_topography", sa.String(length=120), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_summary", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_hypotheses", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_conduct", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_care_coordination", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_bibliography", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("consultant_hypothesis", sa.String(length=200), nullable=True))
    op.add_column(
        "clinical_cases",
        sa.Column("consultant_is_malignant", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("clinical_cases", sa.Column("assigned_to_user_id", sa.Integer(), nullable=True))
    op.add_column("clinical_cases", sa.Column("submitted_at", sa.DateTime(), nullable=True))
    op.add_column("clinical_cases", sa.Column("assigned_at", sa.DateTime(), nullable=True))
    op.add_column("clinical_cases", sa.Column("answered_at", sa.DateTime(), nullable=True))
    op.add_column("clinical_cases", sa.Column("closed_at", sa.DateTime(), nullable=True))

    op.execute("UPDATE clinical_cases SET dentist_state = '' WHERE dentist_state IS NULL")
    op.execute("UPDATE clinical_cases SET dentist_municipality = '' WHERE dentist_municipality IS NULL")
    op.execute("UPDATE clinical_cases SET unit_name = '' WHERE unit_name IS NULL")
    op.execute("UPDATE clinical_cases SET patient_phone = '' WHERE patient_phone IS NULL")
    op.execute("UPDATE clinical_cases SET patient_sex = '' WHERE patient_sex IS NULL")
    op.execute("UPDATE clinical_cases SET patient_age = 0 WHERE patient_age IS NULL")
    op.execute("UPDATE clinical_cases SET patient_city = '' WHERE patient_city IS NULL")
    op.execute("UPDATE clinical_cases SET patient_state = '' WHERE patient_state IS NULL")
    op.execute("UPDATE clinical_cases SET chief_complaint = '' WHERE chief_complaint IS NULL")
    op.execute("UPDATE clinical_cases SET hpi = '' WHERE hpi IS NULL")
    op.execute("UPDATE clinical_cases SET medical_history = '' WHERE medical_history IS NULL")
    op.execute("UPDATE clinical_cases SET dental_history = '' WHERE dental_history IS NULL")
    op.execute("UPDATE clinical_cases SET habits = '' WHERE habits IS NULL")
    op.execute("UPDATE clinical_cases SET meds_history = '' WHERE meds_history IS NULL")
    op.execute("UPDATE clinical_cases SET vitals = '' WHERE vitals IS NULL")
    op.execute("UPDATE clinical_cases SET oral_description = '' WHERE oral_description IS NULL")
    op.execute("UPDATE clinical_cases SET dentist_hypotheses = '' WHERE dentist_hypotheses IS NULL")
    op.execute("UPDATE clinical_cases SET lesion_topography = '' WHERE lesion_topography IS NULL")

    with op.batch_alter_table("clinical_cases") as batch_op:
        batch_op.alter_column("dentist_state", existing_type=sa.String(length=2), nullable=False)
        batch_op.alter_column("dentist_municipality", existing_type=sa.String(length=120), nullable=False)
        batch_op.alter_column("unit_name", existing_type=sa.String(length=200), nullable=False)
        batch_op.alter_column("patient_phone", existing_type=sa.String(length=32), nullable=False)
        batch_op.alter_column("patient_sex", existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column("patient_age", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("patient_city", existing_type=sa.String(length=120), nullable=False)
        batch_op.alter_column("patient_state", existing_type=sa.String(length=2), nullable=False)
        batch_op.alter_column("chief_complaint", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("hpi", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("medical_history", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("dental_history", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("habits", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("meds_history", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("vitals", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("oral_description", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("dentist_hypotheses", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("lesion_topography", existing_type=sa.String(length=120), nullable=False)
        batch_op.create_index(batch_op.f("ix_clinical_cases_assigned_to_user_id"), ["assigned_to_user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_clinical_cases_assigned_to_user_id_users",
            "users",
            ["assigned_to_user_id"],
            ["id"],
        )

    op.alter_column("clinical_cases", "consultant_is_malignant", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("clinical_cases") as batch_op:
        batch_op.drop_constraint("fk_clinical_cases_assigned_to_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_clinical_cases_assigned_to_user_id"))
        batch_op.alter_column("lesion_topography", existing_type=sa.String(length=120), nullable=True)
        batch_op.alter_column("dentist_hypotheses", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("oral_description", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("vitals", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("meds_history", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("habits", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("dental_history", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("medical_history", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("hpi", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("chief_complaint", existing_type=sa.Text(), nullable=True)
        batch_op.alter_column("patient_state", existing_type=sa.String(length=2), nullable=True)
        batch_op.alter_column("patient_city", existing_type=sa.String(length=120), nullable=True)
        batch_op.alter_column("patient_age", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("patient_sex", existing_type=sa.String(length=20), nullable=True)
        batch_op.alter_column("patient_phone", existing_type=sa.String(length=32), nullable=True)
        batch_op.alter_column("unit_name", existing_type=sa.String(length=200), nullable=True)
        batch_op.alter_column("dentist_municipality", existing_type=sa.String(length=120), nullable=True)
        batch_op.alter_column("dentist_state", existing_type=sa.String(length=2), nullable=True)

    op.drop_column("clinical_cases", "closed_at")
    op.drop_column("clinical_cases", "answered_at")
    op.drop_column("clinical_cases", "assigned_at")
    op.drop_column("clinical_cases", "submitted_at")
    op.drop_column("clinical_cases", "assigned_to_user_id")
    op.drop_column("clinical_cases", "consultant_is_malignant")
    op.drop_column("clinical_cases", "consultant_hypothesis")
    op.drop_column("clinical_cases", "consultant_bibliography")
    op.drop_column("clinical_cases", "consultant_care_coordination")
    op.drop_column("clinical_cases", "consultant_conduct")
    op.drop_column("clinical_cases", "consultant_hypotheses")
    op.drop_column("clinical_cases", "consultant_summary")
    op.drop_column("clinical_cases", "lesion_topography")
