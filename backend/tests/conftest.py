"""Fixtures de pytest para tests de aislamiento multi-tenant.

Usa SQLite en memoria para no depender de MySQL en CI ni ensuciar la BD real.
Crea dos colegios con datos cruzados y emite tokens JWT válidos por cada uno.
"""
import os
import sys
import uuid
from pathlib import Path
from datetime import timedelta

# Asegurar que `backend/` está en el sys.path para los imports relativos.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Configurar variables de entorno antes de importar la app.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Importar Base y modelos para que se registren en el metadata.
from core.database import Base, get_db, current_tenant_id  # noqa: E402
from core.security import get_password_hash, create_access_token  # noqa: E402

# Importar todos los modelos para registrarlos en Base.metadata.
from modules.colegios.models import Colegio  # noqa: E402,F401
from modules.usuarios.models import Usuario, RolEnum  # noqa: E402
from modules.alumnos.models import Alumno  # noqa: E402
from modules.talleres.models import Taller  # noqa: E402
from modules.inscripciones.models import Inscripcion  # noqa: E402,F401
from modules.sesiones.models import Sesion  # noqa: E402,F401
from modules.asistencias.models import Asistencia  # noqa: E402,F401
from modules.roles.models import Rol, Permiso  # noqa: E402,F401

from main import app  # noqa: E402


@pytest.fixture(scope="function")
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine):
    SessionTest = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = SessionTest()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def seeded_data(db_session):
    """Crea dos colegios (A y B), un usuario admin por colegio,
    un alumno y un taller por colegio. Devuelve dict con ids y tokens."""
    # Reset del ContextVar entre tests para evitar fugas.
    current_tenant_id.set(None)

    colegio_a = Colegio(
        id=str(uuid.uuid4()),
        nombre_colegio="Colegio A",
        rut_sostenedor="11.111.111-1",
        is_active=True,
    )
    colegio_b = Colegio(
        id=str(uuid.uuid4()),
        nombre_colegio="Colegio B",
        rut_sostenedor="22.222.222-2",
        is_active=True,
    )
    db_session.add_all([colegio_a, colegio_b])
    db_session.flush()

    user_a = Usuario(
        id=str(uuid.uuid4()),
        colegio_id=colegio_a.id,
        nombre="admin_a",
        password_hash=get_password_hash("password_a"),
        rol=RolEnum.admin,
        is_active=True,
    )
    user_b = Usuario(
        id=str(uuid.uuid4()),
        colegio_id=colegio_b.id,
        nombre="admin_b",
        password_hash=get_password_hash("password_b"),
        rol=RolEnum.admin,
        is_active=True,
    )
    db_session.add_all([user_a, user_b])
    db_session.flush()

    alumno_a = Alumno(
        id=str(uuid.uuid4()),
        colegio_id=colegio_a.id,
        rut="10000000-1",
        nombre_completo="Alumno A",
        curso="1A",
        is_active=True,
    )
    alumno_b = Alumno(
        id=str(uuid.uuid4()),
        colegio_id=colegio_b.id,
        rut="20000000-2",
        nombre_completo="Alumno B",
        curso="1B",
        is_active=True,
    )
    db_session.add_all([alumno_a, alumno_b])

    taller_a = Taller(
        id=str(uuid.uuid4()),
        colegio_id=colegio_a.id,
        nombre_taller="Taller A",
        profesor_id=user_a.id,
        cupos_maximos=20,
        dia="Lunes",
    )
    taller_b = Taller(
        id=str(uuid.uuid4()),
        colegio_id=colegio_b.id,
        nombre_taller="Taller B",
        profesor_id=user_b.id,
        cupos_maximos=20,
        dia="Martes",
    )
    db_session.add_all([taller_a, taller_b])
    db_session.commit()

    def _token(usuario: Usuario, colegio: Colegio) -> str:
        return create_access_token(
            data={
                "sub": usuario.nombre,
                "usuario_id": usuario.id,
                "colegio_id": colegio.id,
                "nombre_colegio": colegio.nombre_colegio,
                "rol": usuario.rol.value,
            },
            expires_delta=timedelta(minutes=30),
        )

    return {
        "colegio_a": colegio_a,
        "colegio_b": colegio_b,
        "user_a": user_a,
        "user_b": user_b,
        "alumno_a": alumno_a,
        "alumno_b": alumno_b,
        "taller_a": taller_a,
        "taller_b": taller_b,
        "token_a": _token(user_a, colegio_a),
        "token_b": _token(user_b, colegio_b),
    }


@pytest.fixture(scope="function")
def client(test_engine, db_session):
    """TestClient con get_db sobreescrito al engine de test."""
    SessionTest = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

    def _override_get_db():
        s = SessionTest()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    current_tenant_id.set(None)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
