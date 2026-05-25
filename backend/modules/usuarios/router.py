from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from core.database import get_db
from modules.auth.dependencies import get_current_tenant, TenantContext
from modules.usuarios.schemas import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from modules.usuarios import crud

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.get("", response_model=List[UsuarioResponse])
def list_usuarios(
    skip: int = 0,
    limit: int = 100,
    role_filter: str = None,
    only_with_talleres: bool = False,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    return crud.get_usuarios(
        db, 
        tenant.colegio_id, 
        skip=skip, 
        limit=limit,
        role_filter=role_filter,
        only_with_talleres=only_with_talleres,
        requester_role=tenant.rol
    )


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def get_usuario(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    db_usuario = crud.get_usuario_by_id(db, usuario_id, tenant.colegio_id)
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_usuario


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def create_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    existing = crud.get_usuario_by_nombre(db, usuario.nombre, None)
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
    return crud.create_usuario(db, usuario, tenant.colegio_id)


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def update_usuario(
    usuario_id: UUID,
    usuario: UsuarioUpdate,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    try:
        db_usuario = crud.update_usuario(db, usuario_id, usuario, tenant.colegio_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_usuario


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usuario(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    crud.delete_usuario(db, usuario_id, tenant.colegio_id)
