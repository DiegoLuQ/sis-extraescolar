"""Tests críticos de aislamiento multi-tenant.

Verifican que un usuario autenticado en el Colegio A no pueda leer, modificar
ni eliminar datos del Colegio B, ni siquiera aunque se cuelen vía joins/eager-loads.
"""
from tests.conftest import auth_headers


def test_listado_alumnos_solo_devuelve_colegio_propio(client, seeded_data):
    """Login como colegio A → GET /api/alumnos no devuelve datos de B."""
    resp = client.get("/api/alumnos", headers=auth_headers(seeded_data["token_a"]))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    rut_b = seeded_data["alumno_b"].rut
    assert all(a["rut"] != rut_b for a in data), \
        f"Fuga: el listado del colegio A contiene un alumno de B. Respuesta: {data}"


def test_get_taller_de_otro_colegio_devuelve_404(client, seeded_data):
    """Login como A intentando leer un taller de B → 404 (no 200)."""
    taller_b_id = seeded_data["taller_b"].id
    resp = client.get(
        f"/api/talleres/{taller_b_id}",
        headers=auth_headers(seeded_data["token_a"]),
    )
    assert resp.status_code == 404, \
        f"Fuga cross-tenant: A pudo leer taller de B (status {resp.status_code})"


def test_delete_taller_de_otro_colegio_no_borra(client, seeded_data, db_session):
    """A intenta DELETE sobre taller de B → no debe borrarlo."""
    taller_b_id = seeded_data["taller_b"].id
    client.delete(
        f"/api/talleres/{taller_b_id}",
        headers=auth_headers(seeded_data["token_a"]),
    )
    # Independiente del status (puede ser 204 o 404 según implementación),
    # lo crítico es que el taller de B siga existiendo.
    db_session.expire_all()
    from modules.talleres.models import Taller
    sigue = db_session.query(Taller).filter(Taller.id == taller_b_id).first()
    assert sigue is not None, "Fuga grave: A logró borrar un taller de B"


def test_count_alumnos_aislado_entre_colegios(client, seeded_data):
    """Cada colegio debe ver exactamente sus N alumnos, no los del otro."""
    resp_a = client.get("/api/alumnos", headers=auth_headers(seeded_data["token_a"]))
    resp_b = client.get("/api/alumnos", headers=auth_headers(seeded_data["token_b"]))
    assert resp_a.status_code == 200 and resp_b.status_code == 200
    ruts_a = {a["rut"] for a in resp_a.json()}
    ruts_b = {a["rut"] for a in resp_b.json()}
    assert ruts_a.isdisjoint(ruts_b), \
        f"Fuga: alumnos compartidos entre colegios. A={ruts_a} B={ruts_b}"
