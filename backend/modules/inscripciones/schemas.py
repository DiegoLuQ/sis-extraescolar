from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class InscripcionBase(BaseModel):
    taller_id: UUID
    alumno_id: UUID


class InscripcionCreate(InscripcionBase):
    pass


class InscripcionUpdate(BaseModel):
    estado: Optional[str] = None


class InscripcionResponse(InscripcionBase):
    id: UUID
    colegio_id: UUID
    estado: str

    class Config:
        from_attributes = True


class TallerResumenResponse(BaseModel):
    id: UUID
    nombre_taller: str
    coordinador_nombre: str
    dia: str
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    cupos_maximos: int
    inscritos_count: int
    sesiones_count: int = 0

    class Config:
        from_attributes = True


class InscripcionStatsResponse(BaseModel):
    inscripcion_id: UUID
    alumno_id: UUID
    nombre_alumno: str
    rut_alumno: str
    curso_alumno: str
    estado: str
    porcentaje_asistencia: float
    total_sesiones: int
    asistencias_contadas: int

    class Config:
        from_attributes = True
