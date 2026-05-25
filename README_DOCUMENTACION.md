# Sistema de Gestión de Actividades Extraescolares

## Objetivo del Programa

Sistema SaaS Multi-tenant diseñado para que múltiples colegios gestionen sus actividades extraescolares de forma aislada y segura. Permite administrar usuarios, alumnos, talleres, inscripciones, sesiones y control de asistencia con un sistema robusto de roles y permisos.

---

## Tecnologías

| Capa | Tecnología |
|------|------------|
| **Backend** | FastAPI (Python) + SQLAlchemy 2.0 |
| **Frontend** | Next.js 14 (React) + TypeScript + Tailwind CSS |
| **Base de Datos** | PostgreSQL 16 |
| **Contenedores** | Docker + Docker Compose |
| **Autenticación** | JWT + bcrypt |

---

## Flujo de Trabajo

### Flujo de Autenticación

```
  Usuario                  Frontend                    Backend
    │                         │                           │
    ├─── Login (rut + pass) ──>│                           │
    │                         ├─── POST /api/auth/login ──>│
    │                         │                           ├── Validar credenciales
    │                         │                           ├── Generar JWT (contiene colegio_id)
    │                         │<─── { token, user, permisos }───│
    │<─── Redirigir ──────────│                           │
    │      al Dashboard       │                           │
```

### Flujo de Gestión de Talleres

```
  Admin/Coordinador                                                    
    │                                                                  
    ├─── Crear Taller (nombre, profesor, cupos) ──> API /api/talleres  
    │                                                                  
    ├─── Registrar Alumnos ─────────────────────> API /api/alumnos    
    │                                                                  
    ├─── Inscribir Alumnos en Talleres ──────────> API /api/inscripciones
    │                                                                  
    ├─── Programar Sesiones (fechas, temáticas) ─> API /api/sesiones   
    │                                                                  
    └─── Tomar Asistencia ───────────────────────> API /api/asistencias
```

### Arquitectura Multi-Tenant

```
    JWT Token Payload: { sub: rut, colegio_id: UUID, rol: enum }
                            │
                            ▼
    ┌──────────────────────────────────────────────────────────┐
    │              Middleware de Contexto Tenant               │
    │  - Extrae colegio_id del token JWT                      │
    │  - Filtra automáticamente todas las consultas            │
    │  - Aplica Row Level Security en PostgreSQL               │
    └──────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      Colegio A         Colegio B      Colegio C
     (aislado)         (aislado)      (aislado)
```

---

## Diagrama de Relaciones (ER)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   roles     │ 1───N   │  permisos   │         │  colegios   │
├─────────────┤<────────┤             │         ├─────────────┤
│ id (UUID)   │         │ rol_id (FK) │         │ id (UUID)   │
│ nombre      │         │ modulo      │         │ nombre      │
│ descripcion │         │ puede_*     │         │ rut_sostenedor
└─────────────┘         └─────────────┘         │ is_active   │
                                               └──────┬──────┘
                                                      │
              ┌───────────────┬───────────────┬───────┴───────┐
              │               │               │               │
              ▼               ▼               ▼               ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │   usuarios  │ │   alumnos   │ │   talleres  │ │inscripciones│
       ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤
       │ id (UUID)   │ │ id (UUID)   │ │ id (UUID)   │ │ id (UUID)   │
       │ colegio_id  │ │ colegio_id  │ │ nombre_taller│ │ taller_id   │
       │ rut         │ │ rut         │ │ profesor_id │ │ alumno_id   │
       │ password    │ │ nombre      │ │ cupos_max   │ │ estado      │
       │ rol         │ │ curso       │ └──────┬──────┘ └─────────────┘
       └─────────────┘ └─────────────┘        │
              │                              │
              ▼                         ┌────┴────┐
       ┌─────────────┐                  │         │
       │  sesiones   │                  │         │
       ├─────────────┤                  └────┬────┘
       │ id (UUID)   │                       │
       │ taller_id   │                       ▼
       │ fecha_sesion│                ┌─────────────┐
       │ tematica    │                │  asistentas │
       └──────┬──────┘                ├─────────────┤
              │                       │ id (UUID)   │
              └───────────────────────│ sesion_id   │
                         ┌─────────── │ alumno_id   │
                         │            │ estado      │
                         ▼            └─────────────┘
                  ┌─────────────┐
                  │  asistentas │
                  └─────────────┘
```

---

## Tablas de la Base de Datos

### Tablas Principales

#### 1. `colegios`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `nombre_colegio` | VARCHAR(255) | Nombre del establecimiento |
| `rut_sostenedor` | VARCHAR(50) | RUT del sostenedor |
| `is_active` | BOOLEAN | Estado activo/inactivo |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 2. `usuarios`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `rut` | VARCHAR(50) | RUN del usuario (único por colegio) |
| `nombre_completo` | VARCHAR(255) | Nombre y apellido |
| `password_hash` | VARCHAR(255) | Contraseña encriptada (bcrypt) |
| `email` | VARCHAR(255) | Correo electrónico |
| `telefono` | VARCHAR(50) | Teléfono de contacto |
| `rol` | ENUM | admin, coordinador, extraescolar |
| `is_active` | BOOLEAN | Estado activo/inactivo |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 3. `alumnos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `rut` | VARCHAR(50) | RUN del alumno |
| `nombre_completo` | VARCHAR(255) | Nombre completo |
| `curso` | VARCHAR(50) | Curso/grado (ej: "1° Medio A") |
| `telefono_apoderado` | VARCHAR(50) | Teléfono del apoderado |
| `email_apoderado` | VARCHAR(255) | Email del apoderado |
| `is_active` | BOOLEAN | Estado activo/inactivo |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 4. `talleres`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `nombre_taller` | VARCHAR(255) | Nombre del taller |
| `descripcion` | TEXT | Descripción de actividades |
| `profesor_id` | UUID | FK → usuarios (profesor extraescolar) |
| `cupos_maximos` | INTEGER | Capacidad máxima |
| `dia_semana` | VARCHAR(20) | Día de la semana |
| `hora_inicio` | TIME | Hora de inicio |
| `hora_termino` | TIME | Hora de término |
| `lugar` | VARCHAR(255) | Ubicación/sala |
| `is_active` | BOOLEAN | Estado activo/inactivo |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 5. `inscripciones`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `taller_id` | UUID | FK → talleres |
| `alumno_id` | UUID | FK → alumnos |
| `estado` | ENUM | inscrito, retirado |
| `fecha_inscripcion` | TIMESTAMP | Fecha de inscripción |
| `observaciones` | TEXT | Notas adicionales |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 6. `sesiones`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `taller_id` | UUID | FK → talleres |
| `fecha_sesion` | DATE | Fecha de la clase |
| `tematica` | VARCHAR(255) | Tema/actividad del día |
| `observaciones` | TEXT | Notas de la sesión |
| `creado_por` | UUID | FK → usuarios |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

#### 7. `asistencias`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `colegio_id` | UUID | FK → colegios |
| `sesion_id` | UUID | FK → sesiones |
| `alumno_id` | UUID | FK → alumnos |
| `estado_asistencia` | ENUM | presente, ausente, justo, atraso |
| `observaciones` | TEXT | Notas/justificación |
| `fecha_registro` | TIMESTAMP | Momento del registro |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última modificación |

---

### Tablas Auxiliares

#### 8. `roles`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `nombre` | VARCHAR(100) | Nombre del rol |
| `descripcion` | TEXT | Descripción |
| `is_active` | BOOLEAN | Estado activo |
| `created_at` | TIMESTAMP | Fecha de creación |

#### 9. `permisos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (PK) |
| `rol_id` | UUID | FK → roles |
| `modulo` | VARCHAR(100) | Módulo del sistema |
| `puede_crear` | BOOLEAN | Permiso de creación |
| `puede_leer` | BOOLEAN | Permiso de lectura |
| `puede_editar` | BOOLEAN | Permiso de edición |
| `puede_eliminar` | BOOLEAN | Permiso de eliminación |

---

## Enums Utilizados

```sql
-- Rol de usuario
CREATE TYPE rol_usuario AS ENUM ('admin', 'coordinador', 'extraescolar');

-- Estado de inscripción
CREATE TYPE estado_inscripcion AS ENUM ('inscrito', 'retirado');

-- Estado de asistencia
CREATE TYPE estado_asistencia AS ENUM ('presente', 'ausente', 'justo', 'atraso');
```

---

## Endpoints Principales de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Inicio de sesión |
| GET | `/api/auth/mis-permisos` | Permisos del usuario |
| GET/POST | `/api/colegios` | CRUD Colegios |
| GET/POST/PATCH/DELETE | `/api/usuarios` | CRUD Usuarios |
| GET/POST/PATCH/DELETE | `/api/alumnos` | CRUD Alumnos |
| GET/POST/PATCH/DELETE | `/api/talleres` | CRUD Talleres |
| GET/POST | `/api/inscripciones` | Gestión de inscripciones |
| GET/POST | `/api/sesiones` | Gestión de sesiones |
| GET/POST | `/api/asistencias` | Control de asistencia |
| GET | `/api/estadisticas/*` | Dashboard y métricas |
| GET/POST/PATCH/DELETE | `/api/roles` | Gestión de roles |

---

## Credenciales de Prueba

| Usuario | RUT | Contraseña | Colegio | Rol |
|---------|-----|------------|---------|-----|
| Admin 1 | admin-1 | password123 | Colegio Santiago Centro | admin |
| Coordinador 1 | coord-1 | password123 | Colegio Santiago Centro | coordinador |
| Extraescolar 1 | prof1-1 | password123 | Colegio Santiago Centro | extraescolar |

---

## Puertos de Servicios

| Servicio | Puerto |
|----------|--------|
| Backend API (FastAPI) | 8001 |
| Frontend (Next.js) | 3002 |
| PostgreSQL | 5432 |
| pgAdmin | 8080 |
