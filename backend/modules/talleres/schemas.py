from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List


class TallerHorarioBase(BaseModel):
    dia: str
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None


class TallerHorarioResponse(TallerHorarioBase):
    id: UUID
    taller_id: UUID

    class Config:
        from_attributes = True


class TallerBase(BaseModel):
    nombre_taller: str
    profesor_id: UUID
    cupos_maximos: int
    dia: Optional[str] = "Varios"
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    periodo: int = 2026
    cursos_asignados: Optional[str] = None


class TallerCreate(TallerBase):
    horarios: Optional[List[TallerHorarioBase]] = []


class TallerUpdate(BaseModel):
    nombre_taller: Optional[str] = None
    profesor_id: Optional[UUID] = None
    cupos_maximos: Optional[int] = None
    dia: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    periodo: Optional[int] = None
    cursos_asignados: Optional[str] = None
    is_active: Optional[bool] = None
    horarios: Optional[List[TallerHorarioBase]] = None


class TallerResponse(TallerBase):
    id: UUID
    colegio_id: UUID
    nombre_colegio: str = ""
    nombre_profesor: Optional[str] = None
    is_active: bool
    alumnos_inscritos: int = 0
    horarios: Optional[List[TallerHorarioResponse]] = []

    class Config:
        from_attributes = True


class TallerClonacion(BaseModel):
    source_periodo: int
    target_periodo: int
    taller_ids: List[UUID]
