# --- ETAPA 1: Dependencias ---
FROM node:20-alpine AS deps
# Se añade libc6-compat por compatibilidad con algunas dependencias nativas en Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Se copian los archivos de definición de paquetes
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Instalación de dependencias según el gestor de paquetes del proyecto
RUN \
    if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
    else echo "Lockfile no encontrado." && exit 1; \
    fi

# --- ETAPA 2: Construcción (Builder) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Declarar e inyectar variables de entorno para la compilación de Next.js
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Desactivar telemetría de Next.js durante la compilación si lo deseas
ENV NEXT_TELEMETRY_DISABLED 1

RUN \
    if [ -f package-lock.json ]; then npm run build; \
    elif [ -f yarn.lock ]; then yarn build; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
    else echo "Lockfile no encontrado." && exit 1; \
    fi

# --- ETAPA 3: Ejecución (Runner) ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Buenas prácticas de seguridad: no ejecutar contenedores como root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar recursos estáticos necesarios
COPY --from=builder /app/public ./public

# Configurar permisos para la caché de Next.js
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copiar la build standalone obtenida en la etapa de construcción
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# El servidor standalone genera un archivo server.js para arrancar la app con Node
CMD ["node", "server.js"]