from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


REQUIRED_CASE_COLUMNS = {
    "lesion_topography",
    "consultant_summary",
    "consultant_hypotheses",
    "consultant_conduct",
    "consultant_care_coordination",
    "consultant_bibliography",
    "consultant_hypothesis",
    "consultant_is_malignant",
    "assigned_to_user_id",
    "regulator_user_id",
    "regulation_status",
    "regulation_notes",
    "microscopic_report_date",
    "followup_1m_head_neck_seen",
    "followup_3m_initial_treatment_done",
    "followup_6m_status",
    "followup_main_barriers",
    "submitted_at",
    "assigned_at",
    "answered_at",
    "regulated_at",
    "closed_at",
}


def get_schema_issue(bind: Session | Engine) -> str | None:
    inspector = inspect(bind)

    if not inspector.has_table("clinical_cases"):
        return "A tabela clinical_cases nao existe no banco atual."

    existing = {column["name"] for column in inspector.get_columns("clinical_cases")}
    missing = sorted(REQUIRED_CASE_COLUMNS - existing)
    if missing:
        return (
            "A tabela clinical_cases esta desatualizada. "
            f"Colunas ausentes: {', '.join(missing)}."
        )

    return None
