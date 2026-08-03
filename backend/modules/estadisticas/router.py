from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.estadisticas.schemas import (
    TallerOcupacion,
    AusentismoTaller,
    AlertaInasistencia,
    TallerAusentismoDetalle,
    AlumnoAsistenciaDetalle,
)
from modules.estadisticas import crud

router = APIRouter(prefix="/api/estadisticas", tags=["estadisticas"])


@router.get("/resumen")
def resumen_dashboard(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_resumen_dashboard(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/ocupacion", response_model=List[TallerOcupacion])
def ocupacion_talleres(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_ocupacion_talleres(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/ausentismo", response_model=List[AusentismoTaller])
def ausentismo_talleres(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_ausentismo(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/alertas-inasistencias", response_model=List[AlertaInasistencia])
def alertas_inasistencias(
    min_ausencias: int = 3,
    colegio_id: Optional[str] = None,
    taller_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    target_colegio = colegio_id if (tenant.rol == "admin" and colegio_id) else tenant.colegio_id
    return crud.get_alertas_inasistencias(
        db,
        escuela_id=target_colegio,
        usuario_id=tenant.usuario_id,
        rol=tenant.rol,
        min_ausencias=min_ausencias,
        taller_id=taller_id
    )



@router.get("/detalle-asistencia/{alumno_id}", response_model=AlumnoAsistenciaDetalle)
def detalle_asistencia_alumno(
    alumno_id: UUID,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    if tenant.rol not in ["coordinador", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver el detalle de asistencia")
    detalle = crud.get_detalle_asistencia_alumno(db, alumno_id, tenant.colegio_id)
    if not detalle:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return detalle
