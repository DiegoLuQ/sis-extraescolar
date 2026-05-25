from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from core.config import settings
from modules.auth.router import router as auth_router
from modules.colegios.router import router as colegios_router
from modules.usuarios.router import router as usuarios_router
from modules.alumnos.router import router as alumnos_router
from modules.talleres.router import router as talleres_router
from modules.inscripciones.router import router as inscripciones_router
from modules.sesiones.router import router as sesiones_router
from modules.asistencias.router import router as asistencias_router
from modules.estadisticas.router import router as estadisticas_router
from modules.roles.router import router as roles_router
from modules.reportes.router import router as reportes_router
from modules.correos.router import router as correos_router
from core.limiter import limiter

app = FastAPI(
    title="Sistema de Extraescolares API",
    description="API Multi-tenant para gestión de actividades extraescolares",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3001", "http://localhost:3002", "http://172.21.16.194:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(colegios_router)
app.include_router(usuarios_router)
app.include_router(alumnos_router)
app.include_router(talleres_router)
app.include_router(inscripciones_router)
app.include_router(sesiones_router)
app.include_router(asistencias_router)
app.include_router(estadisticas_router)
app.include_router(roles_router)
app.include_router(reportes_router)
app.include_router(correos_router)


@app.get("/")
async def root():
    return {"message": "API Sistema de Extraescolares", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
