from contextvars import ContextVar
from typing import Optional

from sqlalchemy import create_engine, event
from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
    Session,
    ORMExecuteState,
    with_loader_criteria,
)

from core.config import settings

# ContextVar que almacena el colegio_id del tenant actual (por request)
current_tenant_id: ContextVar[Optional[str]] = ContextVar("current_tenant_id", default=None)

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Tablas que requieren filtrado automático por colegio_id (multi-tenant).
# colegios queda fuera adrede: es la tabla de tenants y se consulta sin filtro.
TENANT_TABLES = {"usuarios", "alumnos", "talleres", "inscripciones", "sesiones", "asistencias", "alertas_inconsistencia", "correos_reportes", "notas_comportamiento", "reportes_programados"}


def _iter_tenant_models():
    """Devuelve las clases mapeadas cuya tabla pertenece a TENANT_TABLES y tiene colegio_id."""
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        table_name = getattr(cls, "__tablename__", None)
        if table_name in TENANT_TABLES and hasattr(cls, "colegio_id"):
            yield cls


@event.listens_for(Session, "do_orm_execute")
def _inject_tenant_filter(execute_state: ORMExecuteState):
    """Inyecta WHERE colegio_id = :tenant_id en cada SELECT ORM, incluidos joins
    y eager-loads (joinedload/selectinload), gracias a with_loader_criteria.

    Se puede saltar pasando execution_options(skip_tenant_filter=True) — útil
    sólo en login y operaciones cross-tenant explícitas (admin)."""
    if not execute_state.is_select or not execute_state.is_orm_statement:
        return

    tenant_id = current_tenant_id.get()
    
    # Debug log
    # print(f"DEBUG: Executing ORM statement. Tenant ID: {tenant_id}")

    if tenant_id is None:
        return

    if execute_state.execution_options.get("skip_tenant_filter", False):
        return

    options = [
        with_loader_criteria(
            cls,
            cls.colegio_id == tenant_id,
            include_aliases=True,
        )
        for cls in _iter_tenant_models()
    ]
    if options:
        execute_state.statement = execute_state.statement.options(*options)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
