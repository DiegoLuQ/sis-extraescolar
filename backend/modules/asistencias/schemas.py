from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AsistenciaBase(BaseModel):
    sesion_id: UUID
    alumno_id: UUID
    estado_asistencia: str


class AsistenciaCreate(AsistenciaBase):
    pass


class AsistenciaUpdate(BaseModel):
    estado_asistencia: Optional[str] = None
    observaciones: Optional[str] = None


class AsistenciaResponse(AsistenciaBase):
    id: UUID
    colegio_id: UUID
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True


class AlertaInconsistenciaResponse(BaseModel):
    id: UUID
    colegio_id: UUID
    sesion_id: UUID
    alumno_id: UUID
    fecha: str
    tipo_alerta: str
    creado_at: Optional[str]
    nombre_alumno: Optional[str] = None
    nombre_taller: Optional[str] = None

    class Config:
        from_attributes = True
