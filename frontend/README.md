# Sis-Extraescolar Frontend

Frontend del Sistema de Gestión de Actividades Extraescolares construido con Next.js 14.

## Tecnologías

- **Framework**: Next.js 14 (App Router)
- **Estilos**: Tailwind CSS
- **Componentes**: Shadcn UI
- **Estado**: Zustand
- **HTTP**: Axios
- **Formularios**: React Hook Form + Zod

## Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Calipso | `#00B4D8` | Primary, headers, acentos |
| Blanco | `#FFFFFF` | Fondos, tarjetas |
| Naranja | `#FF6B35` | Botones CTAs, alertas |

## Estructura

```
frontend/
├── src/
│   ├── app/
│   │   ├── login/           # Página de login
│   │   ├── dashboard/        # Dashboard con métricas
│   │   ├── usuarios/         # CRUD Usuarios
│   │   ├── alumnos/          # CRUD Alumnos
│   │   ├── talleres/         # CRUD Talleres
│   │   ├── inscripciones/    # Gestión Inscripciones
│   │   └── sesiones/        # Sesiones y Asistencia
│   ├── components/
│   │   ├── ui/              # Componentes Shadcn
│   │   └── Sidebar.tsx      # Navegación lateral
│   ├── lib/
│   │   ├── api.ts           # API service layer
│   │   └── utils.ts          # Utilidades
│   ├── store/
│   │   └── authStore.ts     # Estado de autenticación
│   └── types/
│       └── index.ts         # Tipos TypeScript
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Instalación

```bash
cd frontend
npm install
```

## Configuración

Crea un archivo `.env.local` con la URL del backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

## Ejecución

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## Funcionalidades

- **Login**: Autenticación con JWT
- **Dashboard**: Métricas de ocupación, ausentismo y alertas
- **Usuarios**: CRUD de usuarios del sistema
- **Alumnos**: CRUD de alumnos
- **Talleres**: CRUD de talleres con profesor responsable
- **Inscripciones**: Inscripción de alumnos a talleres
- **Sesiones**: Creación de sesiones y toma de asistencia

## Requisitos

- Node.js 18+
- Backend ejecutándose en el puerto configurado
