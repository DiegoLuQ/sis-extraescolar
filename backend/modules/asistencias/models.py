import uuid
import enum
from sqlalchemy import Column, String, Enum, ForeignKey
from core.database import Base


class EstadoAsistenciaEnum(str, enum.Enum):
    presente = "presente"
    ausente = "ausente"
    justificado = "justificado"
    atraso = "atraso"


class Asistencia(Base):
    __tablename__ = "asistencias"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    sesion_id = Column(String(36), ForeignKey("sesiones.id"), nullable=False)
    alumno_id = Column(String(36), ForeignKey("alumnos.id"), nullable=False)
    estado_asistencia = Column(Enum(EstadoAsistenciaEnum), nullable=False)
    observaciones = Column(String(500), nullable=True)


class AlertaInconsistencia(Base):
    __tablename__ = "alertas_inconsistencia"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    sesion_id = Column(String(36), ForeignKey("sesiones.id"), nullable=False)
    alumno_id = Column(String(36), ForeignKey("alumnos.id"), nullable=False)
    fecha = Column(String(10), nullable=False)  # YYYY-MM-DD
    tipo_alerta = Column(String(100), default="Presente en Taller / Ausente en Colegio")
    observacion = Column(String(500), nullable=True)
    creado_at = Column(String(50), nullable=True) # ISO Format


class TipoComportamientoEnum(str, enum.Enum):
    bueno = "bueno"
    malo = "malo"


class NotaComportamiento(Base):
    __tablename__ = "notas_comportamiento"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    sesion_id = Column(String(36), ForeignKey("sesiones.id"), nullable=False)
    alumno_id = Column(String(36), ForeignKey("alumnos.id"), nullable=False)
    tipo = Column(Enum(TipoComportamientoEnum), nullable=False)  # bueno | malo
    nota = Column(String(500), nullable=False)
    creado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    creado_at = Column(String(50), nullable=True)  # ISO Format
