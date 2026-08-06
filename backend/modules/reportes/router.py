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

@router.get("/metas", response_model=schemas.MetasReportResponse)
def get_metas_report(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(...),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")

    return crud.get_metas_report(db, tenant.colegio_id, mes, anio)


@router.get("/resumen-semana", response_model=schemas.WeeklySummaryResponse)
def get_weekly_summary(
    semanas_atras: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")
    
    return crud.get_weekly_summary_report(db, tenant.colegio_id, semanas_atras)


@router.get("/exportar-detalle-excel")
def exportar_detalle_excel(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(...),
    fecha_inicio: str = Query(None),
    fecha_fin: str = Query(None),
    taller_id: str = Query(None),
    dias_semana: str = Query(None),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para exportar reportes")
    
    return crud.generate_attendance_excel(
        db=db,
        colegio_id=tenant.colegio_id,
        mes=mes,
        anio=anio,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        taller_id=taller_id,
        dias_semana_str=dias_semana
    )


@router.get("/ranking-alumnos")
def get_ranking_alumnos(
    mes: int = Query(None, ge=1, le=12),
    anio: int = Query(None),
    taller_id: str = Query(None),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver reportes globales")
    return crud.get_ranking_alumnos(
        db=db,
        colegio_id=tenant.colegio_id,
        mes=mes,
        anio=anio,
        taller_id=taller_id
    )


@router.get("/alumno-detalle/{alumno_id}")
def get_alumno_detalle(
    alumno_id: str,
    mes: int = Query(None, ge=1, le=12),
    anio: int = Query(None),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    if tenant.rol == "monitor":
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el detalle de asistencia")
    res = crud.get_alumno_detalle_asistencia(
        db=db,
        alumno_id=alumno_id,
        colegio_id=tenant.colegio_id,
        mes=mes,
        anio=anio
    )
    if res.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return res



