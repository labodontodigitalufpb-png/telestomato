from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.user import User, UserRole
from app.security.auth import hash_password

def run():
    db: Session = SessionLocal()
    try:
        email = "admin@teleestomato.local"

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("ADMIN já existe:", email)
            return

        admin = User(
            full_name="Admin TeleEstomato",
            email=email,
            phone=None,
            password_hash=hash_password("Admin@12345"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("ADMIN criado com sucesso")
        print("ID:", admin.id)
        print("Email:", admin.email)
        print("Senha inicial: Admin@12345")
    finally:
        db.close()

if __name__ == "__main__":
    run()
