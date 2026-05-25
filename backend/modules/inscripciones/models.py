import uuid
import enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum
from core.database import Base


class EstadoInscripcionEnum(str, enum.Enum):
    inscrito = "inscrito"
    retirado = "retirado"


class Inscripcion(Base):
    __tablename__ = "inscripciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=False, index=True)
    taller_id = Column(String(36), ForeignKey("talleres.id"), nullable=False)
    alumno_id = Column(String(36), ForeignKey("alumnos.id"), nullable=False)
    estado = Column(Enum(EstadoInscripcionEnum), nullable=False, default=EstadoInscripcionEnum.inscrito)
