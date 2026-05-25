from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.database import get_db, current_tenant_id
from core.security import decode_access_token
from core.logging import tenant_context_var, logger
from modules.usuarios.models import Usuario
from modules.talleres.models import Taller

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class TenantContext:
    def __init__(self, usuario_id: str, colegio_id: Optional[str], rol: str, nombre: str, nombre_2: str, nombre_colegio: str):
        self.usuario_id = str(usuario_id)
        self.colegio_id = str(colegio_id) if colegio_id else None
        self.rol = rol
        self.nombre = nombre
        self.nombre_2 = nombre_2
        self.nombre_colegio = nombre_colegio


async def get_current_tenant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    x_colegio_id: Optional[str] = Header(None)
) -> TenantContext:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    usuario_id_str = payload.get("usuario_id")
    token_colegio_id = payload.get("colegio_id")
    rol = payload.get("rol")
    nombre = payload.get("sub")
    nombre_2 = payload.get("nombre_2", "")
    nombre_colegio = payload.get("nombre_colegio", "")

    if usuario_id_str is None:
        raise credentials_exception

    # Normalizar "" o strings como "null"/"undefined" a None para que el filtro global funcione
    header_id = None
    if x_colegio_id and x_colegio_id.strip() and x_colegio_id.lower() not in ["null", "undefined", "none"]:
        header_id = x_colegio_id.strip()
    
    if rol == "admin":
        active_colegio_id = header_id
    else:
        active_colegio_id = header_id or token_colegio_id
    
    # Validar acceso si el rol no es admin y se intenta acceder a un colegio específico
    if rol != "admin" and active_colegio_id:
        if rol == "coordinador":
            # Un coordinador solo puede acceder a su colegio asignado en el token
            if active_colegio_id != token_colegio_id:
                raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este colegio")
        elif rol == "monitor":
            # Un monitor solo puede acceder a colegios donde tiene talleres
            exists = db.query(Taller).filter(
                Taller.profesor_id == usuario_id_str,
                Taller.colegio_id == active_colegio_id
            ).first()
            if not exists:
                raise HTTPException(status_code=403, detail="No tienes talleres asignados en este colegio")

    # Inyectar contexto de tenant en el ContextVar
    current_tenant_id.set(active_colegio_id)
    tenant_context_var.set(active_colegio_id)
    
    logger.debug(f"Contexto activado: User {usuario_id_str} | Colegio {active_colegio_id} | Rol {rol}")

    return TenantContext(
        usuario_id=usuario_id_str,
        colegio_id=active_colegio_id,
        rol=rol,
        nombre=nombre,
        nombre_2=nombre_2,
        nombre_colegio=nombre_colegio
    )


async def get_current_tenant_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[TenantContext]:
    if token is None:
        return None

    try:
        return await get_current_tenant(token, db)
    except HTTPException:
        return None
