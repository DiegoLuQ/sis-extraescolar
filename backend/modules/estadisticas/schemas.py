from pydantic import BaseModel
from uuid import UUID
from typing import Optional


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


class AlertaInasistencia(BaseModel):
    alumno_id: UUID
    rut: str
    nombre_completo: str
    taller: str
    inasistencias_consecutivas: int
