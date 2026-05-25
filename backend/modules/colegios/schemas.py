from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class ColegioBase(BaseModel):
    nombre_colegio: str
    rut_sostenedor: str


class ColegioCreate(ColegioBase):
    pass


class ColegioUpdate(BaseModel):
    nombre_colegio: Optional[str] = None
    rut_sostenedor: Optional[str] = None
    is_active: Optional[bool] = None


class ColegioResponse(ColegioBase):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True
