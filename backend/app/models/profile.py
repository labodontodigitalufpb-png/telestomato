from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.db import Base


class ProfessionalProfile(Base):
    __tablename__ = "professional_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    full_name = Column(String(200), nullable=False)
    age = Column(Integer, nullable=False)
    sex = Column(String(20), nullable=False)
    phone = Column(String(30), nullable=False)
    email = Column(String(200), nullable=False)
    address = Column(String(255), nullable=True)
    profession = Column(String(120), nullable=True)

    municipality = Column(String(150), nullable=False)
    state = Column(String(2), nullable=False)

    cro = Column(String(50), nullable=False)
    unit_name = Column(String(200), nullable=False)
    years_experience = Column(Integer, nullable=False)
    has_specialization = Column(Boolean, default=False, nullable=False)
    specialization = Column(String(200), nullable=True)

    teleconsultant_state = Column(String(2), nullable=True)
    teleconsultant_certificate_url = Column(String(500), nullable=True)

    user = relationship("User", back_populates="profile")
