from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import List, Optional
from modules.reportes_programados.models import FrecuenciaEnum


class ReporteProgramadoBase(BaseModel):
    nombre: Optional[str] = None
    frecuencia: FrecuenciaEnum
    destinatarios: List[EmailStr]
    activo: Optional[bool] = True


class ReporteProgramadoCreate(ReporteProgramadoBase):
    colegio_id: Optional[str] = None


class ReporteProgramadoUpdate(BaseModel):
    nombre: Optional[str] = None
    frecuencia: Optional[FrecuenciaEnum] = None
    destinatarios: Optional[List[EmailStr]] = None
    activo: Optional[bool] = None
    colegio_id: Optional[str] = None


class ReporteProgramadoResponse(ReporteProgramadoBase):
    id: UUID
    colegio_id: UUID
    ultima_ejecucion: Optional[str] = None
    ultimo_estado: Optional[str] = None
    creado_at: Optional[str] = None

    class Config:
        from_attributes = True
