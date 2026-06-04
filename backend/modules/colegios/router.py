from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.colegios.schemas import ColegioCreate, ColegioUpdate, ColegioResponse
from modules.colegios import crud

router = APIRouter(prefix="/api/colegios", tags=["colegios"])


def _solo_admin(tenant: TenantContext):
    """La gestión de colegios (y su meta de asistencia) es exclusiva del admin global."""
    if tenant.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden gestionar establecimientos"
        )


@router.get("", response_model=List[ColegioResponse])
def list_colegios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_colegios(db, skip=skip, limit=limit)


@router.get("/usuarios-count", response_model=Dict[str, int])
def usuarios_count_por_colegio(db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    """Conteo de usuarios activos por colegio (cross-tenant). Solo admin global."""
    _solo_admin(tenant)
    return crud.get_usuarios_count_por_colegio(db)


@router.get("/{colegio_id}", response_model=ColegioResponse)
def get_colegio(colegio_id: UUID, db: Session = Depends(get_db)):
    db_colegio = crud.get_colegio_by_id(db, colegio_id)
    if not db_colegio:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    return db_colegio


@router.post("", response_model=ColegioResponse, status_code=status.HTTP_201_CREATED)
def create_colegio(colegio: ColegioCreate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    _solo_admin(tenant)
    return crud.create_colegio(db, colegio)


@router.patch("/{colegio_id}", response_model=ColegioResponse)
def update_colegio(colegio_id: UUID, colegio: ColegioUpdate, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    _solo_admin(tenant)
    db_colegio = crud.update_colegio(db, colegio_id, colegio)
    if not db_colegio:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    return db_colegio


@router.delete("/{colegio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_colegio(colegio_id: UUID, db: Session = Depends(get_db), tenant: TenantContext = Depends(get_current_tenant)):
    _solo_admin(tenant)
    crud.delete_colegio(db, colegio_id)
