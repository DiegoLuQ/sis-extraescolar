from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AlumnoBase(BaseModel):
    rut: str
    nombre_completo: str
    curso: str


class AlumnoCreate(AlumnoBase):
    pass


class AlumnoUpdate(BaseModel):
    rut: Optional[str] = None
    nombre_completo: Optional[str] = None
    curso: Optional[str] = None
    is_active: Optional[bool] = None


class AlumnoResponse(AlumnoBase):
    id: UUID
    colegio_id: UUID
    is_active: bool

    class Config:
        from_attributes = True
