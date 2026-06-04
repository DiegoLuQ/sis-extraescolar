FROM python:3.12-slim

# Variables recomendadas
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependencias mínimas del sistema.
# build-essential ya no es necesario: todas las dependencias de requirements.txt
# disponen de wheels precompilados (manylinux) para Python 3.12.
# curl se mantiene para healthchecks/diagnóstico.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Usuario no-root (seguridad)
RUN useradd -m appuser

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias primero (mejor cache)
COPY requirements.txt .

# Instalar dependencias
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copiar proyecto
COPY . .

# Asegurar que el entrypoint sea ejecutable y ajustar permisos
RUN chmod +x /app/entrypoint.sh && chown -R appuser:appuser /app

# Usar usuario no-root
USER appuser

# Puerto típico FastAPI/Flask/Django
EXPOSE 8000

# El entrypoint aplica las migraciones (alembic upgrade head) y luego ejecuta el CMD
ENTRYPOINT ["/app/entrypoint.sh"]

# Comando por defecto (FastAPI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]