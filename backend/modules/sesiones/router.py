from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.sesiones.schemas import SesionCreate, SesionResponse
from modules.sesiones import crud, services

router = APIRouter(prefix="/api/sesiones", tags=["sesiones"])


class BloqueoUpdate(BaseModel):
    bloqueada: bool


@router.get("", response_model=List[SesionResponse])
def list_sesiones(taller_id: Optional[UUID] = None, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_sesiones(db, tenant.colegio_id, taller_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/{sesion_id}", response_model=SesionResponse)
def get_sesion(sesion_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    db_sesion = crud.get_sesion_by_id(db, sesion_id, tenant.colegio_id)
    if not db_sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return db_sesion


@router.post("", response_model=SesionResponse, status_code=status.HTTP_201_CREATED)
def create_sesion(sesion: SesionCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.create_sesion(db, sesion, tenant.colegio_id, tenant.usuario_id)
    
@router.delete("/{sesion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sesion(sesion_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar sesiones")
    success = crud.delete_sesion(db, sesion_id, tenant.colegio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

@router.get("/{sesion_id}/absent-from-school")
def get_absent_from_school(sesion_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return services.get_absent_students_from_school(db, sesion_id, tenant.colegio_id)


@router.post("/{sesion_id}/cerrar")
def toggle_cierre_sesion(sesion_id: UUID, data: BloqueoUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="Solo el coordinador o administrador pueden cerrar o reabrir sesiones")
        
    db_sesion = crud.toggle_bloqueo_sesion(db, sesion_id, data.bloqueada, tenant.colegio_id)
    if not db_sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    mail_status = None
    if data.bloqueada:
        mail_status = services.enviar_reporte_inconsistencias_smtp(db, sesion_id, tenant.colegio_id)
        
    return {"status": "success", "bloqueada": db_sesion.bloqueada, "mail_report": mail_status}


class CierreGlobalRequest(BaseModel):
    fecha: str


@router.post("/cierre-global")
def cierre_global_sesiones(data: CierreGlobalRequest, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="Solo el coordinador o administrador pueden realizar el cierre global")
        
    if not tenant.colegio_id:
        raise HTTPException(status_code=400, detail="Debe seleccionar un colegio activo para realizar el cierre global de asistencias")
        
    # Cerrar todas las sesiones de este colegio con fecha <= data.fecha
    count = crud.cierre_global_sesiones(db, data.fecha, tenant.colegio_id)
    
    # Enviar reporte unificado con todas las alertas de la fecha para este colegio
    mail_status = services.enviar_reporte_global_smtp(db, data.fecha, tenant.colegio_id)
    
    return {
        "status": "success", 
        "sesiones_cerradas": count, 
        "mail_report": mail_status
    }


class NotificarInconsistenciaRequest(BaseModel):
    alumno_id: str


@router.post("/{sesion_id}/notificar-inconsistencia")
def notificar_inconsistencia_individual(
    sesion_id: UUID,
    data: NotificarInconsistenciaRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Endpoint para enviar un correo de alerta inmediata cuando el monitor
    marca como 'Asiste' a un alumno que figura como AUSENTE en el colegio.
    El correo es filtrado por el dominio del colegio al que pertenece el taller.
    """
    # Obtener colegio_id desde la sesión si no viene en el contexto (Vista Global)
    from modules.sesiones.models import Sesion as SesionModel
    sesion_db = db.query(SesionModel).filter(SesionModel.id == str(sesion_id)).first()
    if not sesion_db:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    colegio_id = tenant.colegio_id if (tenant.colegio_id and tenant.colegio_id != "None") else sesion_db.colegio_id

    mail_status = services.enviar_alerta_inconsistencia_individual(
        db, sesion_id, data.alumno_id, colegio_id
    )
    return {"status": "success", "mail_report": mail_status}

