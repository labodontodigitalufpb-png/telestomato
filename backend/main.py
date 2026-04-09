from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy.exc import SQLAlchemyError

from app.core.db import engine
from app.core.schema_guard import get_schema_issue

# Routers
from app.routers.auth import router as auth_router
from app.routers.profile import router as profile_router
from app.routers.cases import router as cases_router
from app.routers.case_media import router as case_media_router
from app.routers.teleconsultor import router as teleconsultor_router
from app.routers.pathologist import router as pathologist_router
from app.routers.dashboard import router as dashboard_router
from app.routers.notifications import router as notifications_router
from app.routers.messages import router as messages_router
from app.routers.regulator import router as regulator_router

app = FastAPI(
    title="TeleEstomato API",
    version="0.1.0",
    openapi_tags=[
        {"name": "auth", "description": "Autenticação e sessão do usuário"},
        {"name": "profile", "description": "Perfil profissional do usuário"},
        {"name": "cases", "description": "Relato e acompanhamento de casos clínicos"},
        {"name": "cases-media", "description": "Upload e gestão de mídias do caso"},
        {"name": "teleconsultor", "description": "Fila, avaliação e resposta do teleconsultor"},
        {"name": "pathologist", "description": "Acesso completo aos casos e emissão de laudo histopatológico"},
        {"name": "messages", "description": "Chat e comunicação entre solicitante e especialista"},
        {"name": "notifications", "description": "Notificações do usuário sobre respostas e atualizações"},
        {"name": "regulator", "description": "Fila e ações de telerregulação para casos suspeitos"},
        {"name": "dashboard", "description": "Indicadores e estatísticas do sistema"},
    ],
)

# ✅ CORS DEV (resolve "Failed to fetch" no front)
# - Permite qualquer origem
# - IMPORTANTE: com "*" o allow_credentials precisa ser False
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(cases_router)
app.include_router(case_media_router)
app.include_router(teleconsultor_router)
app.include_router(pathologist_router)
app.include_router(messages_router)
app.include_router(notifications_router)
app.include_router(regulator_router)
app.include_router(dashboard_router)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_ASSETS_DIR = FRONTEND_DIR / "assets"

if FRONTEND_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_ASSETS_DIR)), name="assets")


def frontend_html() -> str:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return "<html><body><h1>Frontend nao encontrado</h1></body></html>"
    return index_path.read_text(encoding="utf-8")


def frontend_file_response(filename: str) -> FileResponse:
    file_path = FRONTEND_DIR / filename
    return FileResponse(file_path)


@app.get("/", response_class=HTMLResponse)
def frontend_index():
    return HTMLResponse(
        frontend_html(),
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/debug-login", response_class=HTMLResponse)
def debug_login():
    return frontend_html()


@app.get("/styles.css")
def frontend_styles():
    return frontend_file_response("styles.css")


@app.get("/app.js")
def frontend_script():
    return frontend_file_response("app.js")


@app.get("/health")
def health():
    try:
        schema_issue = get_schema_issue(engine)
    except SQLAlchemyError as exc:
        return {
            "status": "degraded",
            "database": "unreachable",
            "detail": str(exc),
        }

    if schema_issue:
        return {
            "status": "degraded",
            "database": "reachable",
            "schema": "outdated",
            "detail": schema_issue,
            "action": "Execute 'alembic upgrade head' no backend.",
        }

    return {"status": "ok", "database": "reachable", "schema": "ok"}
