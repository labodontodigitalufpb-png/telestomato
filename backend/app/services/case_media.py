from __future__ import annotations

from pathlib import Path
from typing import Iterable
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.case import ClinicalCase
from app.models.media import CaseMedia, MediaType
from app.models.user import User


UPLOAD_DIR = Path("uploads/cases")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
    "video/mp4",
    "video/quicktime",
    "application/octet-stream",
}

ALLOWED_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".pdf",
    ".mp4",
    ".mov",
}


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def get_case_or_404(db: Session, case_id: int) -> ClinicalCase:
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    return case


def ensure_media_upload_permission(case: ClinicalCase, current_user: User) -> None:
    if role_str(current_user) != "ADMIN" and case.dentist_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para anexar mídia neste caso",
        )


def _safe_suffix(filename: str | None) -> str:
    if not filename:
        return ""
    return Path(filename).suffix[:20]


def validate_content_type(file: UploadFile) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix in ALLOWED_SUFFIXES:
        return
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type} (file={file.filename})",
        )


def save_upload_bytes(case_id: int, filename: str | None, content: bytes) -> Path:
    case_dir = UPLOAD_DIR / str(case_id)
    case_dir.mkdir(parents=True, exist_ok=True)

    suffix = _safe_suffix(filename)
    new_name = f"{uuid.uuid4().hex}{suffix}"
    dest = case_dir / new_name
    dest.write_bytes(content)
    return dest


def create_media_record(
    db: Session,
    *,
    case_id: int,
    media_type: MediaType,
    file_path: str,
    original_filename: str | None,
    content_type: str | None,
) -> CaseMedia:
    media = CaseMedia(
        case_id=case_id,
        media_type=media_type,
        file_path=file_path,
        original_filename=original_filename,
        content_type=content_type,
    )
    db.add(media)
    db.flush()
    return media


def media_to_dict(media: CaseMedia) -> dict:
    return {
        "id": media.id,
        "case_id": media.case_id,
        "media_type": media.media_type.value,
        "file_path": media.file_path,
        "original_filename": media.original_filename,
        "content_type": media.content_type,
        "uploaded_at": media.uploaded_at.isoformat() if media.uploaded_at else None,
    }


def build_batch_response(case_id: int, media_type: MediaType, items: Iterable[CaseMedia]) -> dict:
    serialized = [media_to_dict(item) for item in items]
    return {
        "case_id": case_id,
        "media_type": media_type.value,
        "count": len(serialized),
        "items": serialized,
    }
