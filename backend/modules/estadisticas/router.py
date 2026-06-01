from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.estadisticas.schemas import TallerOcupacion, AusentismoTaller, AlertaInasistencia, TallerAusentismoDetalle
from modules.estadisticas import crud

router = APIRouter(prefix="/api/estadisticas", tags=["estadisticas"])


@router.get("/ocupacion", response_model=List[TallerOcupacion])
def ocupacion_talleres(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_ocupacion_talleres(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/ausentismo", response_model=List[AusentismoTaller])
def ausentismo_talleres(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_ausentismo(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)


@router.get("/alertas-inasistencias", response_model=List[AlertaInasistencia])
def alertas_inasistencias(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    return crud.get_alertas_inasistencias(db, tenant.colegio_id, usuario_id=tenant.usuario_id, rol=tenant.rol)
