import pytest
from datetime import timedelta
from tests.conftest import auth_headers
from core.security import create_access_token
from modules.usuarios.models import RolEnum
import uuid

def create_custom_token(username: str, user_id: str, colegio_id: str, rol: str) -> str:
    return create_access_token(
        data={
            "sub": username,
            "usuario_id": user_id,
            "colegio_id": colegio_id,
            "nombre_colegio": "Test School",
            "rol": rol,
        },
        expires_delta=timedelta(minutes=30),
    )

def test_correos_permissions(client, seeded_data):
    colegio_id = seeded_data["colegio_a"].id
    
    # 1. Admin Token (should be 200)
    admin_token = create_custom_token("admin_test", str(uuid.uuid4()), colegio_id, "admin")
    resp = client.get("/api/correos", headers=auth_headers(admin_token))
    assert resp.status_code == 200, f"Admin should access: {resp.text}"

    # 2. Coordinator Token (should be 403)
    coord_token = create_custom_token("coord_test", str(uuid.uuid4()), colegio_id, "coordinador")
    resp = client.get("/api/correos", headers=auth_headers(coord_token))
    assert resp.status_code == 403, f"Coordinator should be denied: {resp.text}"
    assert "No tienes permisos" in resp.json()["detail"]

    # 3. Monitor Token (should be 403)
    monitor_token = create_custom_token("monitor_test", str(uuid.uuid4()), colegio_id, "monitor")
    resp = client.get("/api/correos", headers=auth_headers(monitor_token))
    assert resp.status_code == 403, f"Monitor should be denied: {resp.text}"
