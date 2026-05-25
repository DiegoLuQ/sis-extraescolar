import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey
from core.database import Base


class CorreoReporte(Base):
    __tablename__ = "correos_reportes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    estado = Column(Boolean, default=True)  # True = Habilitado, False = Deshabilitado
