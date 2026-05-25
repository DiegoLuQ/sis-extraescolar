import uuid
from sqlalchemy import Column, String, Date, Boolean, ForeignKey
from core.database import Base


class Sesion(Base):
    __tablename__ = "sesiones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    taller_id = Column(String(36), ForeignKey("talleres.id"), nullable=False)
    fecha_sesion = Column(Date, nullable=False)
    tematica = Column(String(255), nullable=True)
    creado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    bloqueada = Column(Boolean, default=False)
