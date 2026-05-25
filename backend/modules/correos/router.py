from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.correos.schemas import CorreoReporteCreate, CorreoReporteUpdate, CorreoReporteResponse
from modules.correos import crud

router = APIRouter(prefix="/api/correos", tags=["correos"])


def verify_admin(tenant: TenantContext):
    if tenant.rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para gestionar los correos de reportes")


@router.get("", response_model=List[CorreoReporteResponse])
def list_correos(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    return crud.get_correos_by_colegio(db, tenant.colegio_id)


@router.post("", response_model=CorreoReporteResponse, status_code=status.HTTP_201_CREATED)
def create_correo(correo: CorreoReporteCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    target_colegio_id = tenant.colegio_id or correo.colegio_id
    if not target_colegio_id:
        raise HTTPException(
            status_code=400, 
            detail="Debe seleccionar un colegio específico en el menú lateral o elegir el establecimiento para agregar el destinatario."
        )
    return crud.create_correo(db, correo, target_colegio_id)


@router.patch("/{correo_id}/toggle", response_model=CorreoReporteResponse)
def toggle_correo(correo_id: UUID, update_data: CorreoReporteUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    if update_data.estado is None:
        raise HTTPException(status_code=400, detail="Se requiere el campo estado")
    db_correo = crud.update_correo_estado(db, correo_id, update_data.estado, tenant.colegio_id)
    if not db_correo:
        raise HTTPException(status_code=404, detail="Correo no encontrado")
    return db_correo


@router.delete("/{correo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_correo(correo_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    success = crud.delete_correo(db, correo_id, tenant.colegio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Correo no encontrado")
