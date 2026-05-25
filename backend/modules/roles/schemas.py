from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class PermisoModuloBase(BaseModel):
    modulo: str
    puede_crear: bool = False
    puede_leer: bool = False
    puede_editar: bool = False
    puede_eliminar: bool = False


class PermisoModuloCreate(PermisoModuloBase):
    pass


class PermisoModuloUpdate(PermisoModuloBase):
    pass


class PermisoModuloResponse(PermisoModuloBase):
    id: UUID
    rol_id: UUID

    class Config:
        from_attributes = True


class RolBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class RolCreate(RolBase):
    pass


class RolUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    is_active: Optional[bool] = None


class RolResponse(RolBase):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True


class RolConPermisosResponse(RolResponse):
    permisos: List[PermisoModuloResponse] = []

    class Config:
        from_attributes = True


class PermisosBulkUpdate(BaseModel):
    permisos: List[PermisoModuloBase]
