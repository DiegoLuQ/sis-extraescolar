FROM python:3.12-slim

# Variables recomendadas
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependencias mínimas del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
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

# Cambiar permisos
RUN chown -R appuser:appuser /app

# Usar usuario no-root
USER appuser

# Puerto típico FastAPI/Flask/Django
EXPOSE 8000

# Comando por defecto (FastAPI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]