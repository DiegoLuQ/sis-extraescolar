import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey
from core.database import Base


class Alumno(Base):
    __tablename__ = "alumnos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    rut = Column(String(20), nullable=False)
    nombre_completo = Column(String(255), nullable=False)
    curso = Column(String(50), nullable=False)
    telefono = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
