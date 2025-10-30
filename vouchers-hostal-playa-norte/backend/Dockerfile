############################################
# STAGE 1: Builder
############################################
FROM node:18-bookworm-slim AS builder

LABEL maintainer="Hostal Playa Norte <dev@hostalplayanorte.com>"
LABEL description="Sistema de Vouchers Digitales - Backend"

WORKDIR /app

# Dependencias de compilación (por si hicieran falta en el futuro)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar manifests de dependencias
COPY package*.json .

    # Instalar dependencias (solo producción; ejecuta scripts para addons nativos)
    ENV npm_config_build_from_source=better-sqlite3
    RUN npm ci --only=production

# Copiar código fuente
COPY . .

############################################
# STAGE 2: Production
############################################
FROM node:18-bookworm-slim

WORKDIR /app

# Utilidades runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini curl \
    && rm -rf /var/lib/apt/lists/*

# Usuario no-root
RUN groupadd -g 1001 nodejs \
    && useradd -u 1001 -g 1001 -m nodejs

# node_modules de builder (prod only)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# App
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs db ./db
COPY --chown=nodejs:nodejs start.sh ./start.sh
COPY --chown=nodejs:nodejs package*.json ./

# Directorios necesarios
RUN mkdir -p /data /app/logs \
    && chown -R nodejs:nodejs /data /app/logs

# Entorno por defecto
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/vouchers.db \
    LOG_TO_CONSOLE=true \
    TZ=America/Argentina/Buenos_Aires

USER nodejs

# Healthcheck (deshabilitado temporalmente para debug)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
#   CMD curl -fsS http://localhost:3000/health >/dev/null || exit 1

EXPOSE 3000

# Entrypoint con tini
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]

# Start (modo normal)
CMD ["sh", "./start.sh"]