from pydantic import BaseModel
from uuid import UUID
from datetime import date
from typing import Optional


class SesionBase(BaseModel):
    taller_id: UUID
    fecha_sesion: date
    tematica: Optional[str] = None


class SesionCreate(SesionBase):
    pass


class SesionResponse(SesionBase):
    id: UUID
    colegio_id: UUID
    creado_por: UUID
    total_presentes: Optional[int] = 0
    total_ausentes: Optional[int] = 0
    total_inscritos: Optional[int] = 0
    cupos_disponibles: Optional[int] = 0
    nombre_taller: Optional[str] = None
    bloqueada: Optional[bool] = False

    class Config:
        from_attributes = True
