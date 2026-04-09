from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.security.auth import get_current_user
from app.models.media import MediaType
from app.services.case_media import (
    build_batch_response,
    create_media_record,
    ensure_media_upload_permission,
    get_case_or_404,
    save_upload_bytes,
    validate_content_type,
)


router = APIRouter(prefix="/cases", tags=["cases-media"])


@router.post("/{case_id}/media/batch")
async def upload_case_media_batch(
    case_id: int,
    media_type: MediaType = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_case_or_404(db, case_id)
    ensure_media_upload_permission(case, current_user)

    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    created = []

    for f in files:
        validate_content_type(f)
        content = await f.read()
        dest = save_upload_bytes(case_id, f.filename, content)
        media = create_media_record(
            db,
            case_id=case_id,
            media_type=media_type,
            file_path=str(dest),
            original_filename=f.filename,
            content_type=f.content_type,
        )
        created.append(media)

    db.commit()
    for media in created:
        db.refresh(media)

    return build_batch_response(case_id, media_type, created)
