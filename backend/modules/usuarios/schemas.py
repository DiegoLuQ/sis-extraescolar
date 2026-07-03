from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List


class UsuarioBase(BaseModel):
    nombre: str
    nombre_2: Optional[str] = None
    email: Optional[str] = None
    rol: str
    is_active: bool = True


class UsuarioCreate(UsuarioBase):
    password: str
    colegio_id: Optional[UUID] = None


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    nombre_2: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    rol: Optional[str] = None
    is_active: Optional[bool] = None
    colegio_id: Optional[UUID] = None


class CambiarPasswordRequest(BaseModel):
    password: str = Field(min_length=6)


class UsuarioBulkDelete(BaseModel):
    ids: List[UUID]
    permanente: bool = False  # True = borrado físico (solo admin); False = lógico


class UsuarioResponse(UsuarioBase):
    id: UUID
    colegio_id: Optional[UUID] = None
    rol: str
    is_active: bool

    class Config:
        from_attributes = True
