from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.reportes_programados.schemas import (
    ReporteProgramadoCreate,
    ReporteProgramadoUpdate,
    ReporteProgramadoResponse,
)
from modules.reportes_programados.models import FrecuenciaEnum
from modules.reportes_programados import crud, services

router = APIRouter(prefix="/api/reportes-programados", tags=["reportes-programados"])


def verify_admin(tenant: TenantContext):
    if tenant.rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para gestionar los reportes programados")


@router.get("", response_model=List[ReporteProgramadoResponse])
def list_reportes(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    return crud.get_reportes(db, tenant.colegio_id)


@router.get("/preview")
def preview_reporte(
    colegio_id: str,
    frecuencia: FrecuenciaEnum,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    verify_admin(tenant)
    target_colegio_id = tenant.colegio_id or colegio_id
    if not target_colegio_id:
        raise HTTPException(status_code=400, detail="Debe indicar un colegio para generar la vista previa")
    return services.generar_preview_html(db, target_colegio_id, frecuencia)


@router.get("/{reporte_id}", response_model=ReporteProgramadoResponse)
def get_reporte(reporte_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    db_reporte = crud.get_reporte_by_id(db, reporte_id, tenant.colegio_id)
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return db_reporte


@router.post("", response_model=ReporteProgramadoResponse, status_code=status.HTTP_201_CREATED)
def create_reporte(reporte: ReporteProgramadoCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    target_colegio_id = tenant.colegio_id or reporte.colegio_id
    if not target_colegio_id:
        raise HTTPException(
            status_code=400,
            detail="Debe seleccionar un colegio específico en el menú lateral o elegir el establecimiento para este reporte.",
        )
    return crud.create_reporte(db, reporte, target_colegio_id, creado_por=tenant.usuario_id)


@router.put("/{reporte_id}", response_model=ReporteProgramadoResponse)
def update_reporte(reporte_id: UUID, data: ReporteProgramadoUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    db_reporte = crud.update_reporte(db, reporte_id, data, tenant.colegio_id)
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return db_reporte


@router.patch("/{reporte_id}/toggle", response_model=ReporteProgramadoResponse)
def toggle_reporte(reporte_id: UUID, update_data: ReporteProgramadoUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    if update_data.activo is None:
        raise HTTPException(status_code=400, detail="Se requiere el campo activo")
    db_reporte = crud.update_reporte(db, reporte_id, ReporteProgramadoUpdate(activo=update_data.activo), tenant.colegio_id)
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return db_reporte


@router.delete("/{reporte_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reporte(reporte_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    success = crud.delete_reporte(db, reporte_id, tenant.colegio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")


@router.post("/{reporte_id}/enviar")
def enviar_reporte_manual(reporte_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    verify_admin(tenant)
    db_reporte = crud.get_reporte_by_id(db, reporte_id, tenant.colegio_id)
    if not db_reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    resultado = services.enviar_reporte(db, db_reporte, services.hoy_chile())
    if not resultado.get("sent"):
        raise HTTPException(status_code=422, detail=f"No se pudo enviar el reporte: {resultado.get('status')}")
    return resultado
