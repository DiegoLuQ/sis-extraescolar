# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SaaS multi-tenant system for managing extracurricular activities (talleres) across multiple schools (colegios). Each school's data is isolated via `colegio_id` on every table + automatic SQLAlchemy query filters. The JWT token carries `colegio_id`, and the `get_current_tenant` dependency sets a `ContextVar` that the `do_orm_execute` event listener uses to inject `WHERE colegio_id = :val` into all SELECT queries.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic (Python, in `backend/`)
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Radix UI (in `frontend/`)
- **Database:** MySQL 8.0 (Docker via `docker-compose.yml`, driver: PyMySQL)
- **Auth:** JWT (python-jose) + bcrypt, stored in localStorage, managed by Zustand (`authStore`)
- **State:** Zustand for auth; API calls via Axios with auto-token injection (`src/lib/api.ts`)

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

Modules: `auth`, `colegios`, `usuarios`, `alumnos`, `talleres`, `inscripciones`, `sesiones`, `asistencias`, `estadisticas`, `roles`

### Multi-Tenant Flow
1. Login sends RUT + password + optional `client_id` (colegio UUID)
2. Backend returns JWT containing `{sub, usuario_id, colegio_id, rol}`
3. `get_current_tenant` dependency (in `modules/auth/dependencies.py`) decodes JWT, returns `TenantContext`, and sets `current_tenant_id` ContextVar
4. The `do_orm_execute` event in `core/database.py` intercepts all ORM SELECT queries and injects `WHERE colegio_id = :tenant_id` for tables in `TENANT_TABLES`
5. All CRUD operations also explicitly filter by `tenant.colegio_id`

### Frontend Structure
- `src/app/` — Next.js App Router pages (`login/`, `dashboard/` with sub-routes per entity)
- `src/components/` — Shared components + `ui/` (Radix-based, shadcn/ui style)
- `src/lib/api.ts` — Centralized Axios client with all API methods per entity
- `src/store/authStore.ts` — Zustand persistent auth state
- `src/hooks/usePermisos.ts` — Permission checking hook
- `src/types/` — TypeScript interfaces for all entities

### Roles & Permissions
Three user roles: `admin`, `coordinador`, `extraescolar`. Permissions are stored in the `permisos` table per role, with CRUD flags (`puede_crear`, `puede_leer`, `puede_editar`, `puede_eliminar`) per module.

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
- Rate limiting is configured via `slowapi` (`core/limiter.py`)
- Structured logging with tenant context is in `core/logging.py`
- Frontend API URL defaults to `http://localhost:8001` (via `NEXT_PUBLIC_API_URL` env var), matching the backend port
