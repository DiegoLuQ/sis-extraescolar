# Guía Completa de Docker & Docker Compose para Plataformas Web

Esta guía detalla la arquitectura y configuración Docker implementada en este proyecto, y proporciona una plantilla paso a paso para crear y desplegar una nueva plataforma web (Frontend + Backend + Base de Datos).

---

## 1. Arquitectura y Configuración del Proyecto Actual

El sistema actual está diseñado con una arquitectura desacoplada de contenedores ligeros que interactúan a través de redes Docker internas:

```
                  Internet / Usuario
                          │
                          ▼
            ┌───────────────────────────┐
            │   nginx-proxy + SSL       │ (Enrutador inverso global)
            └─────────────┬─────────────┘
                          │ Red Docker: 'red_produccion'
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│     sis_frontend      │   │      sis_backend      │
│  (Next.js Standalone) │   │   (FastAPI + Python)  │
│      Puerto 3000      │   │      Puerto 8000      │
└───────────────────────┘   └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │    mcdp_mysql:3306    │ (Base de datos compartida)
                            └───────────────────────┘
```

### 1.1. Análisis del `docker-compose.yml` (Producción con Proxy Inverso)

En [docker-compose.yml](file:///c:/SISSISTEMAS-PRUEBA/Sis-Extraescolar/docker-compose.yml):

- **No expone puertos al Host (`ports:` ausente)**: No es necesario mapear puertos `8000:8000` o `3000:3000` al servidor host porque el contenedor de Nginx Proxy (`nginx-proxy`) se comunica internamente dentro de la red Docker.
- **Enrutamiento por Path y Host**:
  - `VIRTUAL_HOST`: Asigna el dominio (ej. `talleres.dpmc.cl`).
  - `VIRTUAL_PATH=/api/` en el backend: Redirige las peticiones que comiencen por `/api/` directamente al backend.
  - `VIRTUAL_PATH=/` en el frontend: Redirige el resto de peticiones al frontend.
- **SSL Automático**: Las variables `LETSENCRYPT_HOST` y `LETSENCRYPT_EMAIL` permiten que el compañero `acme-companion` solicite y renueve certificados HTTPS de forma transparente.
- **Red Externa (`external: true`)**: Permite que los contenedores se unan a una red preexistente (`red_produccion`) donde ya viven otros servicios, como el servidor MySQL (`mcdp_mysql`).

### 1.2. Análisis del `docker-compose.des.yml` (Desarrollo / Pruebas)

En [docker-compose.des.yml](file:///c:/SISSISTEMAS-PRUEBA/Sis-Extraescolar/docker-compose.des.yml):

- **Mapeo directo de puertos**:
  - Backend: `"${BACKEND_PORT:-8000}:8000"`
  - Frontend: `"${FRONTEND_PORT:-8091}:3000"`
- **Acceso por IP**: Ideal para probar en una máquina o VPS sin dominio público configurado, accediendo directamente por `http://<IP_SERVIDOR>:<PUERTO>`.

### 1.3. Análisis del `backend/Dockerfile` (FastAPI)

En [backend/Dockerfile](file:///c:/SISSISTEMAS-PRUEBA/Sis-Extraescolar/backend/Dockerfile):

- **Imagen base liviana**: `python:3.12-slim`.
- **Caché eficiente**: Se copia primero `requirements.txt` y se instalan las dependencias antes de copiar el código fuente.
- **Seguridad**: Ejecuta bajo un usuario sin privilegios `appuser` (no root).
- **Entrypoint con migraciones automáticas**: [backend/entrypoint.sh](file:///c:/SISSISTEMAS-PRUEBA/Sis-Extraescolar/backend/entrypoint.sh) ejecuta `alembic upgrade head` cada vez que el contenedor arranca antes de iniciar el servidor `uvicorn`.

### 1.4. Análisis del `frontend/Dockerfile` (Next.js Multi-stage)

En [frontend/Dockerfile](file:///c:/SISSISTEMAS-PRUEBA/Sis-Extraescolar/frontend/Dockerfile):

- **Construcción en 3 etapas (Multi-stage)**:
  1. `deps`: Instala únicamente las dependencias de Node.
  2. `builder`: Compila la aplicación con `npm run build`.
  3. `runner`: Crea una imagen mínima final copiando solo los artefactos compilados (`.next/standalone` y `.next/static`), reduciendo el tamaño de ~1GB a menos de ~150MB.
- **Variable de compilación crítica (`ARG NEXT_PUBLIC_API_URL`)**: Next.js embebe las variables `NEXT_PUBLIC_*` en el código JavaScript del navegador durante el comando `build`. Por eso se pasa como `ARG` en el `docker-compose` en la sección `build.args`.

---

## 2. Guía Paso a Paso para Crear una Nueva Plataforma

Sigue estos pasos para crear el entorno Docker de una nueva aplicación.

### Paso 1: Estructura de Carpetas Recomendada

```text
mi-nueva-plataforma/
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh          # (Opcional, para migraciones)
│   ├── requirements.txt       # (O package.json si es Node)
│   └── ... (código backend)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js         # (o next.config.mjs / vite.config.ts)
│   └── ... (código frontend)
├── .env                       # Variables de entorno locales
├── .env.production            # Variables para producción
└── docker-compose.yml         # Orquestación de servicios
```

---

### Paso 2: Configurar Next.js para Docker (Frontend)

Para usar la compilación ligera `standalone`, activa la opción en tu `frontend/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // <-- Imprescindible para el Dockerfile multi-stage
};

module.exports = nextConfig;
```

Crea el archivo `frontend/Dockerfile`:

```dockerfile
# 1. Dependencias
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumento para que Next.js incruste la URL en el build del cliente
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# 3. Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

# Copia solo la salida standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

---

### Paso 3: Configurar el Backend (FastAPI / Python)

Crea el archivo `backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Usuario no root
RUN useradd -m appuser

# Instalar librerías
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiar código
COPY . .

# Entrypoint para migraciones (si aplica)
RUN chmod +x /app/entrypoint.sh && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Crea `backend/entrypoint.sh`:

```bash
#!/bin/sh
set -e

# Si usas Alembic / Django / Prisma, ejecuta migraciones aquí:
if command -v alembic > /dev/null 2>&1; then
  echo "Ejecutando migraciones..."
  alembic upgrade head
fi

exec "$@"
```

> **Nota para Windows**: Asegúrate de que `entrypoint.sh` tenga saltos de línea formato Unix (`LF`), no Windows (`CRLF`). En VS Code / Antigravity puedes cambiarlo en la esquina inferior derecha.

---

### Paso 4: Crear el `docker-compose.yml`

Selecciona la opción que se ajuste a tu infraestructura:

#### Opción A: Producción con Dominio y Nginx-Proxy (Recomendado)
Usa este modelo si ya tienes en el servidor un contenedor `nginx-proxy` con `acme-companion` para certificados SSL automáticos:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nueva_app_backend
    restart: always
    environment:
      - PORT=8000
      - DATABASE_URL=${DATABASE_URL}
      - SECRET_KEY=${SECRET_KEY}
      - FRONTEND_URL=${FRONTEND_URL}
      - VIRTUAL_HOST=${VIRTUAL_HOST}
      - VIRTUAL_PATH=/api/
    networks:
      - red_produccion

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    container_name: nueva_app_frontend
    restart: always
    environment:
      - PORT=3000
      - NODE_ENV=production
      - VIRTUAL_HOST=${VIRTUAL_HOST}
      - VIRTUAL_PATH=/
      - LETSENCRYPT_HOST=${LETSENCRYPT_HOST}
      - LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
    networks:
      - red_produccion
    depends_on:
      - backend

networks:
  red_produccion:
    external: true
```

#### Opción B: Standalone / Desarrollo con Puertos Directos y Base de Datos propia
Usa este modelo si la plataforma es independiente, tiene su propia base de datos (PostgreSQL o MySQL) y se accede directamente por puertos:

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0 # o postgres:16-alpine
    container_name: nueva_app_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root_password_segura
      MYSQL_DATABASE: mi_base_datos
      MYSQL_USER: mi_usuario
      MYSQL_PASSWORD: mi_password
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3307:3306" # Expuesto al host si se requiere acceso externo
    networks:
      - red_interna

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nueva_app_backend
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-8001}:8000"
    environment:
      - DATABASE_URL=mysql+pymysql://mi_usuario:mi_password@db:3306/mi_base_datos
      - SECRET_KEY=${SECRET_KEY}
      - FRONTEND_URL=http://${SERVER_IP:-localhost}:${FRONTEND_PORT:-3001}
    depends_on:
      - db
    networks:
      - red_interna

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=http://${SERVER_IP:-localhost}:${BACKEND_PORT:-8001}
    container_name: nueva_app_frontend
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-3001}:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
    depends_on:
      - backend
    networks:
      - red_interna

networks:
  red_interna:
    driver: bridge

volumes:
  db_data:
```

---

### Paso 5: Archivo de Variables de Entorno (`.env`)

Crea tu archivo `.env` o `.env.production`:

```env
# Servidor y Puertos
SERVER_IP=186.64.120.228
BACKEND_PORT=8001
FRONTEND_PORT=3001

# Dominios y SSL (Si usas Nginx-Proxy)
VIRTUAL_HOST=nueva-plataforma.tudominio.cl
LETSENCRYPT_HOST=nueva-plataforma.tudominio.cl
LETSENCRYPT_EMAIL=admin@tudominio.cl

# URLs de Comunicación
FRONTEND_URL=https://nueva-plataforma.tudominio.cl
NEXT_PUBLIC_API_URL=https://nueva-plataforma.tudominio.cl

# Base de datos
DATABASE_URL=mysql+pymysql://usuario:password@mcdp_mysql:3306/nueva_bd

# Seguridad
SECRET_KEY=clave_aleatoria_muy_larga_y_segura
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

---

## 3. Comandos Esenciales para Despliegue y Mantenimiento

### 3.1. Crear la Red Externa (Si aplica)
Si tu `docker-compose.yml` usa `external: true`, la red debe crearse antes de levantar los contenedores:
```bash
docker network create red_produccion
```

### 3.2. Construir y Levantar Contenedores
```bash
# Con archivo por defecto (docker-compose.yml)
docker compose --env-file .env.production up -d --build

# Con archivo específico (por ejemplo desarrollo)
docker compose -f docker-compose.des.yml --env-file .env up -d --build
```

### 3.3. Ver Logs en Tiempo Real
```bash
# Todos los servicios
docker compose logs -f

# Un solo servicio (ej. backend)
docker compose logs -f backend
```

### 3.4. Detener y Reiniciar
```bash
# Detener contenedores
docker compose down

# Reiniciar un servicio individual
docker compose restart backend
```

### 3.5. Ejecutar Comandos dentro del Contenedor
```bash
# Entrar a la terminal del backend
docker compose exec backend bash

# Ejecutar migraciones manuales
docker compose exec backend alembic upgrade head
```

---

## 4. Preguntas Frecuentes y Errores Comunes

1. **El Frontend no se conecta con el Backend (`NEXT_PUBLIC_API_URL` undefined o apunta a localhost)**:
   - *Causa*: Next.js reemplaza `NEXT_PUBLIC_*` en tiempo de compilación (`build`), no en tiempo de ejecución.
   - *Solución*: Asegúrate de pasar `args: - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}` dentro del bloque `build:` en el `docker-compose.yml` y reconstruir con `--build`.

2. **Error `network red_produccion not found`**:
   - *Causa*: La red externa declarada no existe en el daemon de Docker.
   - *Solución*: Ejecuta `docker network create red_produccion`.

3. **Error `standard_init_linux.go: exec: "./entrypoint.sh": no such file or directory`**:
   - *Causa*: El archivo fue editado en Windows con saltos de línea CRLF (`\r\n`).
   - *Solución*: Cambiar el formato del archivo a `LF` en tu editor de código.
