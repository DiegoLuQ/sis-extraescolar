import pytest
from datetime import date
from uuid import uuid4
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, AlertaInconsistencia, EstadoAsistenciaEnum
from tests.conftest import auth_headers

def test_delete_sesion_cascades_to_asistencias_and_alertas(client, db_session, seeded_data):
    # 1. Obtener datos de colegio y token
    colegio_a = seeded_data["colegio_a"]
    user_a = seeded_data["user_a"]
    taller_a = seeded_data["taller_a"]
    alumno_a = seeded_data["alumno_a"]
    token_a = seeded_data["token_a"]

    # 2. Crear una sesión de prueba
    sesion = Sesion(
        id=str(uuid4()),
        colegio_id=colegio_a.id,
        taller_id=taller_a.id,
        fecha_sesion=date.today(),
        tematica="Tema prueba cascada",
        creado_por=user_a.id,
        bloqueada=False
    )
    db_session.add(sesion)
    db_session.commit()

    # 3. Crear asistencia y alerta de inconsistencia relacionadas
    asistencia = Asistencia(
        id=str(uuid4()),
        colegio_id=colegio_a.id,
        sesion_id=sesion.id,
        alumno_id=alumno_a.id,
        estado_asistencia=EstadoAsistenciaEnum.presente,
        observaciones="Observacion prueba"
    )
    alerta = AlertaInconsistencia(
        id=str(uuid4()),
        colegio_id=colegio_a.id,
        sesion_id=sesion.id,
        alumno_id=alumno_a.id,
        fecha=str(date.today()),
        tipo_alerta="Prueba cascada",
        creado_at=date.today().isoformat()
    )
    db_session.add_all([asistencia, alerta])
    db_session.commit()

    # Verificar que existan en la base de datos
    assert db_session.query(Sesion).filter(Sesion.id == sesion.id).first() is not None
    assert db_session.query(Asistencia).filter(Asistencia.id == asistencia.id).first() is not None
    assert db_session.query(AlertaInconsistencia).filter(AlertaInconsistencia.id == alerta.id).first() is not None

    sesion_id = sesion.id
    asistencia_id = asistencia.id
    alerta_id = alerta.id

    # 4. Eliminar la sesión a través de la API
    headers = auth_headers(token_a)
    resp = client.delete(f"/api/sesiones/{sesion_id}", headers=headers)
    assert resp.status_code == 204

    # 5. Verificar cascada en la base de datos (expirar caché de sesión de prueba primero)
    db_session.expire_all()
    assert db_session.query(Sesion).filter(Sesion.id == sesion_id).first() is None
    assert db_session.query(Asistencia).filter(Asistencia.id == asistencia_id).first() is None
    assert db_session.query(AlertaInconsistencia).filter(AlertaInconsistencia.id == alerta_id).first() is None
