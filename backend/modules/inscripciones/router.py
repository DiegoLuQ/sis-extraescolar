from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import pandas as pd
import io
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.inscripciones.schemas import (
    InscripcionCreate, 
    InscripcionUpdate, 
    InscripcionResponse,
    TallerResumenResponse,
    InscripcionStatsResponse
)
from modules.inscripciones import crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inscripciones", tags=["inscripciones"])


@router.get("/template")
def get_template(tenant: TenantContext = Depends(get_current_tenant)):
    df = pd.DataFrame(columns=["RUT ALUMNO"])
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Plantilla')
    output.seek(0)
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_inscripciones.xlsx"}
    )


@router.post("/bulk-upload/{taller_id}")
async def bulk_upload_inscripciones(
    taller_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db), 
    tenant: TenantContext = Depends(get_current_tenant)
):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        data = df.to_dict('records')
        
        stats = crud.bulk_upsert_inscripciones(db, taller_id, str(tenant.colegio_id), data)
        return stats
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error procesando bulk-upload de inscripciones")
        raise HTTPException(status_code=400, detail="Error al procesar el archivo")


@router.get("/resumen", response_model=List[TallerResumenResponse])
def get_talleres_resumen(
    db: Session = Depends(get_db), 
    tenant: TenantContext = Depends(get_current_tenant)
):
    return crud.get_talleres_resumen(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/taller/{taller_id}/stats", response_model=List[InscripcionStatsResponse])
def get_taller_inscripciones_stats(
    taller_id: str,
    db: Session = Depends(get_db), 
    tenant: TenantContext = Depends(get_current_tenant)
):
    return crud.get_taller_inscripciones_stats(db, taller_id, tenant.colegio_id)


@router.get("/taller/{taller_id}/export")
def export_taller_inscripciones(
    taller_id: str,
    db: Session = Depends(get_db), 
    tenant: TenantContext = Depends(get_current_tenant)
):
    df = crud.export_taller_inscripciones(db, taller_id, tenant.colegio_id)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Inscripciones')
    output.seek(0)
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=taller_{taller_id}_inscripciones.xlsx"}
    )


@router.get("", response_model=List[InscripcionResponse])
def list_inscripciones(
    taller_id: Optional[UUID] = None, 
    db: Session = Depends(get_db), 
    tenant: TenantContext = Depends(get_current_tenant)
):
    return crud.get_inscripciones(db, tenant.colegio_id, taller_id)


@router.post("", response_model=InscripcionResponse, status_code=status.HTTP_201_CREATED)
def create_inscripcion(inscripcion: InscripcionCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    try:
        return crud.create_inscripcion(db, inscripcion, tenant.colegio_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{inscripcion_id}", response_model=InscripcionResponse)
def update_inscripcion(inscripcion_id: UUID, inscripcion: InscripcionUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    db_inscripcion = crud.update_inscripcion(db, inscripcion_id, inscripcion, tenant.colegio_id)
    if not db_inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    return db_inscripcion

@router.delete("/{inscripcion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inscripcion(
    inscripcion_id: UUID,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    success = crud.delete_inscripcion(db, inscripcion_id, tenant.colegio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    return None

