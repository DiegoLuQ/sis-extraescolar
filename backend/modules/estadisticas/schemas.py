from pydantic import BaseModel
from uuid import UUID
from typing import List


class TallerOcupacion(BaseModel):
    taller_id: UUID
    nombre_taller: str
    cupos_maximos: int
    inscripciones_activas: int
    porcentaje_ocupacion: float


class AusentismoTaller(BaseModel):
    taller_id: UUID
    nombre_taller: str
    total_sesiones: int
    total_asistencias: int
    total_ausencias: int
    porcentaje_ausentismo: float


class TallerAusentismoDetalle(BaseModel):
    nombre_taller: str
    total_sesiones: int
    ausencias: int
    porcentaje_ausencia: float
    taller_id: UUID
    inscripcion_id: UUID


class AlertaInasistencia(BaseModel):
    alumno_id: UUID
    nombre_completo: str
    curso: str
    talleres: List[TallerAusentismoDetalle]
