# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SaaS multi-tenant system for managing extracurricular activities (talleres) across multiple schools (colegios). Each school's data is isolated via `colegio_id` on every table + automatic SQLAlchemy query filters. The JWT token carries `colegio_id`, and the `get_current_tenant` dependency sets a `ContextVar` that the `do_orm_execute` event listener uses to inject `WHERE colegio_id = :val` into all SELECT queries.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic (Python, in `backend/`)
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Radix UI (in `frontend/`)
- **Database:** MySQL 8.0 (Docker via `docker-compose.yml`, driver: PyMySQL)
- **Auth:** JWT (python-jose) + bcrypt, stored in localStorage, managed by Zustand (`authStore`)
- **State:** Zustand for auth; API calls via Axios with auto-token injection (`src/lib/api.ts`); server state via TanStack Query

## Commands

### Backend (run from `backend/`)
```bash
# Activate venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# Run dev server
uvicorn main:app --reload --port 8001

# Alembic migrations
alembic revision --autogenerate -m "description"
alembic upgrade head

# Seed test data
python scripts/seed_data.py
```

### Frontend (run from `frontend/`)
```bash
npm run dev      # Starts on port 3002
npm run build
npm run lint
```

### Docker (database only, from project root)
```bash
docker-compose up -d       # Starts MySQL (3306) + phpMyAdmin (8080)
docker-compose down
```

## Architecture

### Backend Module Pattern
Each domain entity lives in `backend/modules/<entity>/` with a consistent structure:
- `models.py` — SQLAlchemy model (every model has `colegio_id` FK, PKs are `String(36)` storing UUIDs)
- `schemas.py` — Pydantic request/response schemas
- `crud.py` — Database queries (always filtered by `colegio_id`)
- `router.py` — FastAPI endpoints (prefix: `/api/<entity>`)

Modules: `auth`, `colegios`, `usuarios`, `alumnos`, `talleres`, `inscripciones`, `sesiones`, `asistencias`, `estadisticas`, `roles`, `reportes`, `correos`

### Multi-Tenant Flow
1. Login sends RUT + password + optional `client_id` (colegio UUID)
2. Backend returns JWT containing `{sub, usuario_id, colegio_id, rol}`
3. `get_current_tenant` dependency (`modules/auth/dependencies.py`) decodes JWT, returns `TenantContext`, and sets `current_tenant_id` ContextVar
4. The `do_orm_execute` event in `core/database.py` intercepts all ORM SELECT queries and injects `WHERE colegio_id = :tenant_id` for tables in `TENANT_TABLES`
5. All CRUD operations also explicitly filter by `tenant.colegio_id`

**Bypassing the filter:** Pass `.execution_options(skip_tenant_filter=True)` to any query that must run cross-tenant (e.g., the student sync ETL looking up a colegio by name).

**Admin tenant switching:** The `admin` role reads the `X-Colegio-ID` request header (sent automatically by the Axios interceptor from `localStorage['colegio_id']`) to set the active tenant. Non-admin roles are locked to their JWT's `colegio_id`.

### External Database Integration
`core/external_db.py` holds two SQLAlchemy engines (`mc_engine`, `dp_engine`) that connect to separate MySQL databases of the two partner schools:
- **MC** — Colegio Macaya (env: `EXTERNAL_DB_MC_URL`)
- **DP** — Colegio Diego Portales (env: `EXTERNAL_DB_DP_URL`)

These are used for:
- **Student sync** (`modules/alumnos/sync.py`): ETL that pulls `alumnos + cursos` from the external DB, normalizes course names to a local format (e.g., `"Primer Año A"` → `"1ºA"`), and upserts into the local `alumnos` table via `POST /api/alumnos/sync-external`.
- **Attendance inconsistency detection** (`modules/sesiones/services.py`): When closing a session or marking a student present, the system queries `asistencia_diaria` in the external DB to detect students marked present in the taller but absent in the school's daily roll (`AlertaInconsistencia`).

### Inconsistency Alerting Flow
`modules/sesiones/services.py` contains three SMTP email senders (via Gmail):
1. `enviar_alerta_inconsistencia_individual` — fires immediately when a monitor marks a student present who is absent in the school DB
2. `enviar_reporte_inconsistencias_smtp` — sends a summary report when a session is closed (`POST /api/sesiones/{id}/cerrar`)
3. `enviar_reporte_global_smtp` — bulk report when coordinator runs global closure (`POST /api/sesiones/cierre-global`)

Email recipients are managed in the `correos` module (`correos_reportes` table, admin-only CRUD). SMTP credentials per school are in env vars (`MC_SENDER_EMAIL`, `MC_SENDER_PASSWORD`, `DP_SENDER_EMAIL`, `DP_SENDER_PASSWORD`).

### Frontend Structure
- `src/app/` — Next.js App Router pages (`login/`, `dashboard/` with sub-routes per entity)
- `src/components/` — Shared components + `ui/` (Radix-based, shadcn/ui style)
- `src/lib/api.ts` — Centralized Axios client with all API methods grouped by entity (`authApi`, `alumnosApi`, `talleresApi`, etc.)
- `src/store/authStore.ts` — Zustand persistent auth state (persisted as `auth-storage` in localStorage)
- `src/hooks/queries/` — TanStack Query hooks per entity (`useTalleres.ts`, `useAlumnos.ts`, etc.) with centralized cache keys in `keys.ts`
- `src/hooks/usePermisos.ts` — Permission checking hook
- `src/types/` — TypeScript interfaces for all entities

### Roles & Permissions
Three user roles: `admin`, `coordinador`, `monitor`. Permissions are stored in the `permisos` table per role, with CRUD flags (`puede_crear`, `puede_leer`, `puede_editar`, `puede_eliminar`) per module.

- `admin` — no tenant restriction, switches via `X-Colegio-ID` header
- `coordinador` — locked to their own `colegio_id` from the JWT
- `monitor` — can only access colegios where they have assigned talleres

## Service Ports

| Service    | Port |
|------------|------|
| Backend    | 8001 |
| Frontend   | 3002 |
| MySQL      | 3306 |
| phpMyAdmin | 8080 |

## Key Conventions

- All API routes are prefixed with `/api/`
- The system language is Spanish (field names, UI labels, enum values)
- UUIDs stored as `String(36)` primary keys (MySQL-compatible, not native UUID type)
- Student identification uses Chilean RUT (e.g., `12.345.678-9`); normalize with `format_rut()` in `modules/alumnos/crud.py` before DB queries
- `Taller.periodo` is the academic year (integer); used to filter active talleres and to clone a set of talleres to a new year
- `Sesion.bloqueada` marks a closed/locked session; attendance can no longer be modified after closing
- Rate limiting is configured via `slowapi` (`core/limiter.py`)
- Structured logging with tenant context is in `core/logging.py`
- Frontend API URL defaults to `http://localhost:8001` (via `NEXT_PUBLIC_API_URL` env var)
- `TENANT_TABLES` in `core/database.py` is the authoritative list of tables that receive automatic tenant filtering; new multi-tenant models must be added here
