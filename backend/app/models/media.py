from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.db import Base


class MediaType(str, enum.Enum):
    image = "image"
    exam = "exam"
    video = "video"
    consent = "consent"


class CaseMedia(Base):
    __tablename__ = "case_media"

    id = Column(Integer, primary_key=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    case_id = Column(
        Integer,
        ForeignKey("clinical_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # string para evitar import circular
    case = relationship("ClinicalCase", back_populates="media")

    media_type = Column(
        Enum(MediaType, name="mediatype"),
        nullable=False,
        index=True,
    )

    file_path = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=True)
    content_type = Column(String(120), nullable=True)
