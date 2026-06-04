import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from core.database import Base


class Taller(Base):
    __tablename__ = "talleres"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    nombre_taller = Column(String(255), nullable=False)
    profesor_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    cupos_maximos = Column(Integer, nullable=False)
    dia = Column(String(100), nullable=False)  # Resumen de días, ej. "Lunes, Miércoles"
    periodo = Column(Integer, nullable=False, default=2026, index=True)
    hora_inicio = Column(String(5), nullable=True)  # HH:MM fallback/primer bloque
    hora_fin = Column(String(5), nullable=True)     # HH:MM fallback/primer bloque
    is_active = Column(Boolean, default=True)
    cursos_asignados = Column(String(500), nullable=True)
    # Meta de asistencia individual (%). NULL => hereda la meta del colegio.
    meta_asistencia = Column(Integer, nullable=True)

    horarios = relationship("TallerHorario", backref="taller", cascade="all, delete-orphan", lazy="selectin")


class TallerHorario(Base):
    __tablename__ = "taller_horarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    taller_id = Column(String(36), ForeignKey("talleres.id", ondelete="CASCADE"), nullable=False, index=True)
    dia = Column(String(20), nullable=False)
    hora_inicio = Column(String(5), nullable=True)
    hora_fin = Column(String(5), nullable=True)
