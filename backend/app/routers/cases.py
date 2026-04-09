from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.schema_guard import get_schema_issue
from app.security.auth import get_current_user
from app.models.user import User
from app.models.case import ClinicalCase, CaseStatus
from app.models.media import CaseMedia
from app.models.media import MediaType
from app.schemas.case import CaseCreate, CaseOut, CaseOutPublic, CaseUpdate
from app.services.case_media import (
    create_media_record,
    ensure_media_upload_permission,
    get_case_or_404,
    media_to_dict,
    save_upload_bytes,
    validate_content_type,
)

router = APIRouter(prefix="/cases", tags=["cases"])


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def can_view_case(case: ClinicalCase, user: User) -> bool:
    role = role_str(user)
    if role == "ADMIN":
        return True
    if case.dentist_user_id == user.id:
        return True
    if case.assigned_to_user_id == user.id:
        return True
    if case.regulator_user_id == user.id:
        return True
    return False


@router.post("", response_model=CaseOutPublic)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if role_str(current_user) not in {"DENTIST", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o profissional solicitante pode criar casos",
        )

    schema_issue = get_schema_issue(db.bind)
    if schema_issue:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"{schema_issue} Execute 'alembic upgrade head' no backend e tente novamente."
            ),
        )

    case = ClinicalCase(
        dentist_user_id=current_user.id,
        status=CaseStatus.draft,
        **payload.model_dump(),
    )
    db.add(case)
    try:
        db.commit()
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "O banco de dados parece estar desatualizado para o modelo atual de casos. "
                "Execute 'alembic upgrade head' no backend e tente novamente."
            ),
        ) from exc
    db.refresh(case)
    return case


@router.get("/mine", response_model=list[CaseOutPublic])
def list_my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ClinicalCase)
        .filter(ClinicalCase.dentist_user_id == current_user.id)
        .order_by(ClinicalCase.created_at.desc())
        .all()
    )


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)

    if not can_view_case(case, current_user):
        raise HTTPException(status_code=403, detail="Sem permissão para ver este caso")

    return case


@router.put("/{case_id}", response_model=CaseOut)
def update_case(
    case_id: int,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)

    if role_str(current_user) != "ADMIN" and case.dentist_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para editar este caso",
        )

    if case.status == CaseStatus.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Casos fechados não podem ser editados",
        )

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum campo enviado para atualização",
        )

    for field, value in data.items():
        setattr(case, field, value)

    db.commit()
    db.refresh(case)
    return case


@router.get("/{case_id}/media/{media_id}/file")
def get_case_media_file(
    case_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)

    if not can_view_case(case, current_user):
        raise HTTPException(status_code=403, detail="Sem permissão para ver este caso")

    media = (
        db.query(CaseMedia)
        .filter(CaseMedia.id == media_id, CaseMedia.case_id == case_id)
        .first()
    )
    if not media:
        raise HTTPException(status_code=404, detail="Midia não encontrada")

    file_path = Path(media.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo da mídia não encontrado")

    return FileResponse(
        path=file_path,
        media_type=media.content_type or None,
        filename=media.original_filename or file_path.name,
    )


@router.post("/{case_id}/submit", response_model=CaseOut)
def submit_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)

    if role_str(current_user) != "ADMIN" and case.dentist_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para submeter este caso",
        )

    if case.status not in [CaseStatus.draft, CaseStatus.submitted]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Caso em status inválido para submissão: {case.status.value}",
        )

    media_count = (
        db.query(CaseMedia.id)
        .filter(CaseMedia.case_id == case.id)
        .count()
    )
    if media_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anexe ao menos uma midia antes de submeter o caso.",
        )

    case.status = CaseStatus.submitted
    case.submitted_at = func.now()

    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/media")
async def upload_case_media(
    case_id: int,
    media_type: MediaType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)
    ensure_media_upload_permission(case, current_user)
    validate_content_type(file)
    content = await file.read()
    dest = save_upload_bytes(case.id, file.filename, content)
    media = create_media_record(
        db,
        case_id=case.id,
        media_type=media_type,
        file_path=str(dest),
        original_filename=file.filename,
        content_type=file.content_type,
    )
    db.commit()
    db.refresh(media)
    return media_to_dict(media)
