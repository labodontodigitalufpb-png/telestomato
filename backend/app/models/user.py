import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.core.db import Base
from sqlalchemy.orm import relationship



class UserRole(str, enum.Enum):
    DENTIST = "DENTIST"
    TELECONSULTANT = "TELECONSULTANT"
    PATHOLOGIST = "PATHOLOGIST"
    REGULATOR = "REGULATOR"
    ADMIN = "ADMIN"


class ApprovalStatus(str, enum.Enum):
    approved = "approved"
    pending = "pending"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)

    password_hash = Column(String(255), nullable=False)

    role = Column(Enum(UserRole, name="user_role"), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(
        Enum(ApprovalStatus, name="approvalstatus"),
        default=ApprovalStatus.approved,
        nullable=False,
    )
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    profile = relationship("ProfessionalProfile", back_populates="user", uselist=False)
