from fastapi import FastAPI

from app.routers.teleconsultor import router as teleconsultor_router

app = FastAPI()

app.include_router(teleconsultor_router)


from app.routers.auth import router as auth_router
from app.routers.profile import router as profile_router
from app.routers.cases import router as cases_router




app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(cases_router)
app.include_router(teleconsultor_router)

@app.get("/")
def root():
    return {"status": "ok"}




