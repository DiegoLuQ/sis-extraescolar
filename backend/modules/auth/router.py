from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.security import verify_password, create_access_token
from core.config import settings
from core.limiter import limiter
from fastapi import Request
from modules.usuarios.models import Usuario
from modules.colegios.models import Colegio
from modules.roles.models import Rol, Permiso
from modules.talleres.models import Taller
from modules.auth.dependencies import TenantContext, get_current_tenant
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    usuario_id: str
    nombre: str
    nombre_2: str
    nombre_colegio: str
    rol: str


class PermisoResponse(BaseModel):
    modulo: str
    puede_crear: bool
    puede_leer: bool
    puede_editar: bool
    puede_eliminar: bool


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    logger.debug("Login attempt received")

    query = db.query(Usuario).filter(
        Usuario.nombre == form_data.username,
        Usuario.is_active == True
    )

    if form_data.client_id:
        query = query.filter(Usuario.colegio_id == form_data.client_id)

    usuarios = query.all()

    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Usuario o contraseña incorrectos"
    )

    if not usuarios or len(usuarios) > 1:
        # Sin client_id y nombre duplicado: tratamos igual que credenciales inválidas
        # para no filtrar la existencia del usuario.
        raise invalid_credentials

    usuario = usuarios[0]

    password_hash = str(usuario.password_hash)
    if not verify_password(form_data.password, password_hash):
        raise invalid_credentials
    
    # Validación de colegio (solo si el usuario tiene uno asignado)
    nombre_colegio = ""
    if usuario.colegio_id:
        db_colegio = db.query(Colegio).filter(Colegio.id == usuario.colegio_id).first()
        if not db_colegio or db_colegio.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El colegio no está activo o no existe"
            )
        nombre_colegio = db_colegio.nombre_colegio
    
    rol_str = usuario.rol.value if hasattr(usuario.rol, 'value') else str(usuario.rol)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": usuario.nombre,
            "usuario_id": str(usuario.id),
            "colegio_id": str(usuario.colegio_id) if usuario.colegio_id else None,
            "nombre_colegio": nombre_colegio,
            "nombre_2": usuario.nombre_2 or usuario.nombre,
            "rol": rol_str
        },
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    tenant: TenantContext = Depends(get_current_tenant)
):
    return {
        "usuario_id": tenant.usuario_id,
        "nombre": tenant.nombre,
        "nombre_2": tenant.nombre_2,
        "nombre_colegio": tenant.nombre_colegio,
        "rol": tenant.rol
    }


@router.get("/me/colegios")
async def get_mis_colegios(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Retorna la lista de colegios a los que el usuario tiene acceso"""
    if tenant.rol == "admin":
        return db.query(Colegio).filter(Colegio.is_active == True).all()
    
    elif tenant.rol == "coordinador":
        # Un coordinador solo ve su propio colegio
        # Necesitamos obtener el colegio_id del usuario directamente si no está en el tenant
        usuario = db.query(Usuario).filter(Usuario.id == tenant.usuario_id).first()
        if usuario and usuario.colegio_id:
            return db.query(Colegio).filter(Colegio.id == usuario.colegio_id).all()
        return []
        
    elif tenant.rol == "monitor":
        # Un monitor ve los colegios donde tiene talleres (cross-tenant para soportar monitores compartidos)
        colegio_ids = (
            db.query(Taller.colegio_id)
            .filter(Taller.profesor_id == tenant.usuario_id)
            .execution_options(skip_tenant_filter=True)
            .distinct()
            .all()
        )
        ids = [c[0] for c in colegio_ids]
        if not ids:
            return []
        return db.query(Colegio).filter(Colegio.id.in_(ids)).execution_options(skip_tenant_filter=True).all()
        
    return []


@router.get("/mis-permisos", response_model=List[PermisoResponse])
async def get_mis_permisos(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Obtiene los permisos del usuario actual basados en su rol"""
    rol_nombre = tenant.rol
    
    # Buscar el rol por nombre
    rol = db.query(Rol).filter(Rol.nombre == rol_nombre).first()
    if not rol:
        return []
    
    # Obtener permisos del rol
    permisos = db.query(Permiso).filter(Permiso.rol_id == rol.id).all()
    
    return [
        PermisoResponse(
            modulo=str(p.modulo),
            puede_crear=bool(p.puede_crear),
            puede_leer=bool(p.puede_leer),
            puede_editar=bool(p.puede_editar),
            puede_eliminar=bool(p.puede_eliminar)
        )
        for p in permisos
    ]
