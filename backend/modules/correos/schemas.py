from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional


class CorreoReporteBase(BaseModel):
    email: EmailStr
    estado: Optional[bool] = True


class CorreoReporteCreate(CorreoReporteBase):
    colegio_id: Optional[str] = None


class CorreoReporteUpdate(BaseModel):
    estado: Optional[bool] = None


class CorreoReporteResponse(CorreoReporteBase):
    id: UUID
    colegio_id: UUID

    class Config:
        from_attributes = True
