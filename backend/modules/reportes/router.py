from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.reportes import crud, schemas
from typing import List

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

@router.get("/asistencia-mensual", response_model=schemas.MonthlyReportResponse)
def get_monthly_report(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(...),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")
    
    return crud.get_monthly_attendance_report(db, tenant.colegio_id, mes, anio)

@router.get("/asistencia-semanal", response_model=schemas.WeeklyReportResponse)
def get_weekly_report(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(...),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")
    
    return crud.get_weekly_attendance_report(db, tenant.colegio_id, mes, anio)

@router.get("/asistencia-anual", response_model=schemas.AnnualReportResponse)
def get_annual_report(
    anio: int = Query(...),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")
    
    return crud.get_annual_attendance_report(db, tenant.colegio_id, anio)
