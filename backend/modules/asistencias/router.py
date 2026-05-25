from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from pydantic import BaseModel
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.asistencias.schemas import AsistenciaCreate, AsistenciaResponse, AlertaInconsistenciaResponse
from modules.asistencias import crud

router = APIRouter(prefix="/api/asistencias", tags=["asistencias"])


class BulkAsistenciaCreate(BaseModel):
    sesion_id: UUID
    lista: List[dict]


@router.get("/{sesion_id}", response_model=List[AsistenciaResponse])
def get_asistencias(sesion_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_asistencias(db, tenant.colegio_id, sesion_id)


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def create_asistencias_bulk(data: BulkAsistenciaCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    from modules.sesiones.models import Sesion
    sesion = db.query(Sesion).filter(Sesion.id == str(data.sesion_id)).first()
    if sesion and getattr(sesion, "bloqueada", False) and tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="Esta sesión ha sido cerrada por coordinación y no puede ser editada")
    return crud.create_asistencias_bulk(db, data.sesion_id, data.lista, tenant.colegio_id)


@router.get("/historial/alertas", response_model=List[AlertaInconsistenciaResponse])
def get_alertas_historial(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_alertas_inconsistencia(db, tenant.colegio_id)
