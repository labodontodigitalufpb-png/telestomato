from datetime import datetime, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.db import get_db
from app.models.case import ClinicalCase, CaseStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# -------------------------
# Pydantic response models
# -------------------------

class SummaryResponse(BaseModel):
    since: str
    total: int
    by_status: Dict[str, int]
    suspected_cases: int
    avg_patient_age: Optional[float]
    by_sex: Dict[str, int]
    professionals_total: int
    teleconsultants_total: int
    professionals_by_role: Dict[str, int]


class StateCountItem(BaseModel):
    state: str
    count: int


class TimeSeriesItem(BaseModel):
    period: str
    count: int


class OpenClosedResponse(BaseModel):
    since: str
    open: int
    closed: int


class TopographyItem(BaseModel):
    topography: str
    count: int


class HypothesisItem(BaseModel):
    hypothesis: str
    count: int


class SLAResponse(BaseModel):
    since: str
    n_cases_considered: int
    avg_hours: Optional[float]
    median_hours: Optional[float]
    p90_hours: Optional[float]


# -------------------------
# Helpers
# -------------------------

def _start_date(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _get_first_response_column():
    """
    Tenta identificar a coluna de 1ª resposta no ClinicalCase.
    Ajuste aqui se o seu modelo usa outro nome.
    """
    for attr in ("first_response_at", "answered_at", "first_answer_at"):
        if hasattr(ClinicalCase, attr):
            return getattr(ClinicalCase, attr), attr
    return None, None


# -------------------------
# Endpoints
# -------------------------

@router.get("/summary", response_model=SummaryResponse)
def summary(
    days: int = 90,
    db: Session = Depends(get_db),
):
    since = _start_date(days)

    total = (
        db.query(func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .scalar()
    )

    rows = (
        db.query(ClinicalCase.status, func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .group_by(ClinicalCase.status)
        .all()
    )

    by_status = {status.value: int(count) for status, count in rows}

    suspected_cases = (
        db.query(func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.consultant_is_malignant.is_(True))
        .scalar()
    )

    avg_patient_age = (
        db.query(func.avg(ClinicalCase.patient_age))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.patient_age.isnot(None))
        .scalar()
    )

    sex_rows = (
        db.query(ClinicalCase.patient_sex, func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.patient_sex.isnot(None))
        .group_by(ClinicalCase.patient_sex)
        .all()
    )
    by_sex = {str(sex).upper(): int(count) for sex, count in sex_rows if sex}

    professionals_total = (
        db.query(func.count(User.id))
        .filter(User.role != UserRole.ADMIN)
        .scalar()
    )

    teleconsultants_total = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.TELECONSULTANT)
        .scalar()
    )

    role_rows = (
        db.query(User.role, func.count(User.id))
        .filter(User.role != UserRole.ADMIN)
        .group_by(User.role)
        .all()
    )
    professionals_by_role = {
        (role.value if hasattr(role, "value") else str(role)): int(count)
        for role, count in role_rows
        if role
    }

    return {
        "since": since.isoformat(),
        "total": int(total or 0),
        "by_status": by_status,
        "suspected_cases": int(suspected_cases or 0),
        "avg_patient_age": float(avg_patient_age) if avg_patient_age is not None else None,
        "by_sex": by_sex,
        "professionals_total": int(professionals_total or 0),
        "teleconsultants_total": int(teleconsultants_total or 0),
        "professionals_by_role": professionals_by_role,
    }


@router.get("/cases-by-state", response_model=List[StateCountItem])
def cases_by_state(
    days: int = 180,
    db: Session = Depends(get_db),
):
    since = _start_date(days)

    rows = (
        db.query(ClinicalCase.patient_state, func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.patient_state.isnot(None))
        .group_by(ClinicalCase.patient_state)
        .order_by(func.count(ClinicalCase.id).desc())
        .all()
    )

    return [{"state": state, "count": int(count)} for state, count in rows if state]


@router.get("/cases-by-week", response_model=List[TimeSeriesItem])
def cases_by_week(
    weeks: int = 26,
    db: Session = Depends(get_db),
):
    since = _start_date(weeks * 7)

    rows = (
        db.query(
            func.date_trunc("week", ClinicalCase.created_at).label("period"),
            func.count(ClinicalCase.id).label("count"),
        )
        .filter(ClinicalCase.created_at >= since)
        .group_by("period")
        .order_by("period")
        .all()
    )

    return [{"period": p.isoformat(), "count": int(c)} for p, c in rows]


@router.get("/cases-by-month", response_model=List[TimeSeriesItem])
def cases_by_month(
    months: int = 12,
    db: Session = Depends(get_db),
):
    since = _start_date(months * 31)

    rows = (
        db.query(
            func.date_trunc("month", ClinicalCase.created_at).label("period"),
            func.count(ClinicalCase.id).label("count"),
        )
        .filter(ClinicalCase.created_at >= since)
        .group_by("period")
        .order_by("period")
        .all()
    )

    return [{"period": p.isoformat(), "count": int(c)} for p, c in rows]


@router.get("/cases-open-vs-closed", response_model=OpenClosedResponse)
def cases_open_vs_closed(
    days: int = 180,
    db: Session = Depends(get_db),
):
    since = _start_date(days)

    open_status = [
        CaseStatus.submitted,
        CaseStatus.assigned,
        CaseStatus.answered,
        CaseStatus.draft,
    ]
    closed_status = [CaseStatus.closed]

    open_count = (
        db.query(func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.status.in_(open_status))
        .scalar()
    )

    closed_count = (
        db.query(func.count(ClinicalCase.id))
        .filter(ClinicalCase.created_at >= since)
        .filter(ClinicalCase.status.in_(closed_status))
        .scalar()
    )

    return {
        "since": since.isoformat(),
        "open": int(open_count or 0),
        "closed": int(closed_count or 0),
    }


@router.get("/sla-time-to-first-response", response_model=SLAResponse)
def sla_time_to_first_response(
    days: int = 180,
    db: Session = Depends(get_db),
):
    since = _start_date(days)

    resp_col, _ = _get_first_response_column()
    if resp_col is None:
        raise HTTPException(
            status_code=501,
            detail="Não encontrei coluna de 1ª resposta no ClinicalCase.",
        )

    rows = (
        db.query(ClinicalCase.created_at, resp_col)
        .filter(ClinicalCase.created_at >= since)
        .filter(resp_col.isnot(None))
        .all()
    )

    if not rows:
        return {
            "since": since.isoformat(),
            "n_cases_considered": 0,
            "avg_hours": None,
            "median_hours": None,
            "p90_hours": None,
        }

    deltas = [
        (resp_at - created_at).total_seconds() / 3600
        for created_at, resp_at in rows
        if resp_at and created_at and resp_at >= created_at
    ]

    if not deltas:
        return {
            "since": since.isoformat(),
            "n_cases_considered": 0,
            "avg_hours": None,
            "median_hours": None,
            "p90_hours": None,
        }

    deltas.sort()
    n = len(deltas)

    avg = sum(deltas) / n
    median = deltas[n // 2] if n % 2 else (deltas[n // 2 - 1] + deltas[n // 2]) / 2
    p90 = deltas[int(0.9 * (n - 1))]

    return {
        "since": since.isoformat(),
        "n_cases_considered": n,
        "avg_hours": float(avg),
        "median_hours": float(median),
        "p90_hours": float(p90),
    }
