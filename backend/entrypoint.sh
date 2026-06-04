#!/bin/sh
set -e

# Aplica las migraciones pendientes antes de arrancar la aplicación.
# La URL de la base de datos la toma Alembic desde DATABASE_URL (ver alembic/env.py).
echo "[entrypoint] Aplicando migraciones de base de datos (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Migraciones aplicadas. Iniciando aplicación..."
exec "$@"
