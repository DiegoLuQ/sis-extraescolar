import uuid
import enum
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, JSON
from core.database import Base


class FrecuenciaEnum(str, enum.Enum):
    diario = "diario"
    semanal = "semanal"
    mensual = "mensual"


class ReporteProgramado(Base):
    __tablename__ = "reportes_programados"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    nombre = Column(String(150), nullable=True)
    frecuencia = Column(Enum(FrecuenciaEnum), nullable=False)
    destinatarios = Column(JSON, nullable=False)
    activo = Column(Boolean, default=True)
    ultima_ejecucion = Column(String(10), nullable=True)  # YYYY-MM-DD
    ultimo_estado = Column(String(100), nullable=True)
    creado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    creado_at = Column(String(50), nullable=True)  # ISO
