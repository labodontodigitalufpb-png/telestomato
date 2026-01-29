from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.security.auth import get_current_user
from app.models.user import User
from app.models.case import ClinicalCase, CaseStatus
from app.schemas.case import CaseOut

router = APIRouter(prefix="/teleconsultor", tags=["teleconsultor"])

@router.get("/my-cases", response_model=List[CaseOut])
def my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(ClinicalCase)
        .filter(ClinicalCase.status.in_([CaseStatus.assigned, CaseStatus.answered, CaseStatus.closed]))
        .order_by(ClinicalCase.created_at.desc())
    )
    return q.all()

@router.post("/next", response_model=Optional[CaseOut])
def next_case(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = (
        db.query(ClinicalCase)
        .filter(ClinicalCase.status == CaseStatus.submitted)
        .order_by(ClinicalCase.created_at.asc())
        .first()
    )
    return case

