from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from core.database import get_db
from modules.roles.schemas import (
    RolCreate, RolUpdate, RolResponse, RolConPermisosResponse,
    PermisoModuloBase, PermisosBulkUpdate, PermisoModuloResponse
)
from modules.roles import crud
from modules.auth.dependencies import get_current_tenant

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("", response_model=List[RolResponse])
def list_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    return crud.get_roles(db, skip=skip, limit=limit)


@router.get("/{rol_id}", response_model=RolResponse)
def get_rol(
    rol_id: UUID,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    rol = crud.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return rol


@router.get("/{rol_id}/permisos", response_model=List[PermisoModuloResponse])
def get_permisos_rol(
    rol_id: UUID,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    rol = crud.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return crud.get_permisos_by_rol(db, rol_id)


@router.post("", response_model=RolResponse, status_code=status.HTTP_201_CREATED)
def create_rol(
    rol: RolCreate,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    # Verificar si ya existe
    existente = crud.get_rol_by_nombre(db, rol.nombre)
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre")
    
    nuevo_rol = crud.create_rol(db, rol.model_dump())
    # Crear permisos por defecto
    crud.create_default_permisos(db, nuevo_rol.id)
    return nuevo_rol


@router.patch("/{rol_id}", response_model=RolResponse)
def update_rol(
    rol_id: UUID,
    rol: RolUpdate,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    db_rol = crud.update_rol(db, rol_id, rol.model_dump(exclude_unset=True))
    if not db_rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return db_rol


@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rol(
    rol_id: UUID,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    success = crud.delete_rol(db, rol_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rol no encontrado")


@router.put("/{rol_id}/permisos", response_model=List[PermisoModuloResponse])
def update_permisos_rol(
    rol_id: UUID,
    permisos: PermisosBulkUpdate,
    db: Session = Depends(get_db),
    tenant: dict = Depends(get_current_tenant)
):
    rol = crud.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    
    permisos_data = [p.model_dump() for p in permisos.permisos]
    return crud.update_permisos_rol(db, rol_id, permisos_data)
