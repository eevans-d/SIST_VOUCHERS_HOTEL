############################################
# STAGE 1: Builder
############################################
FROM node:18-alpine AS builder

LABEL maintainer="Hostal Playa Norte <dev@hostalplayanorte.com>"
LABEL description="Sistema de Vouchers Digitales - Backend"

WORKDIR /app

# Dependencias de compilación (por si hicieran falta en el futuro)
RUN apk add --no-cache python3 make g++

# Copiar manifests de dependencias
COPY package*.json ./

# Instalar dependencias (solo producción; no hay paso de build)
RUN npm ci --only=production --ignore-scripts

# Copiar código fuente
COPY . .

############################################
# STAGE 2: Production
############################################
FROM node:18-alpine

WORKDIR /app

# Utilidades runtime
RUN apk add --no-cache tini curl

# Usuario no-root
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

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

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:3000/health >/dev/null || exit 1

EXPOSE 3000

# Entrypoint con tini
ENTRYPOINT ["/sbin/tini", "--"]

# Start (modo normal)
# CMD ["sh", "./start.sh"]

# MODO DEBUG TEMPORAL: mantener la VM viva para inspección y SSH
CMD ["sh", "-lc", "echo 'DEBUG MODE: sleeping for inspection'; env; ls -la; sleep 3600"]
# ============================================\n# STAGE 1: Builder\n# ============================================ \nFROM node:18-alpine AS builder\n\nLABEL maintainer=\"Hostal Playa Norte <dev@hostalplayanorte.com>\"\nLABEL description=\"Sistema de Vouchers Digitales - Backend\"\n\nWORKDIR /app\n\n# Instalar dependencias de build\nRUN apk add --no-cache python3 make g++\n\n# Copiar archivos de dependencias\nCOPY package*.json .\n\n# Instalar dependencias (solo producción)\nRUN npm ci --only=production --ignore-scripts\n\n# Copiar código fuente\nCOPY . .\n\n# ============================================ \n# STAGE 2: Production\n# ============================================ \nFROM node:18-alpine\n\nWORKDIR /app\n\n# Instalar solo runtime necesario\nRUN apk add --no-cache tini curl\n\n# Crear usuario no-root\nRUN addgroup -g 1001 -S nodejs && \    adduser -S nodejs -u 1001\n\n# Copiar node_modules desde builder\nCOPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules\n\n# Copiar aplicación\nCOPY --chown=nodejs:nodejs src ./src\nCOPY --chown=nodejs:nodejs db ./db\nCOPY --chown=nodejs:nodejs package*.json .\n\n# Crear directorios necesarios\nRUN mkdir -p /data /app/logs && \    chown -R nodejs:nodejs /data /app/logs\n\n# Variables de entorno por defecto\nENV NODE_ENV=production \    PORT=3000 \    DATABASE_PATH=/data/vouchers.db \    TZ=America/Argentina/Buenos_Aires\n\n# Cambiar a usuario no-root\nUSER nodejs\n\n# Health check\nHEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \  CMD node -e \"require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });\"\n\n# Exponer puerto\nEXPOSE 3000\n\n# Usar tini para manejo correcto de señales\nENTRYPOINT [\"/sbin/tini\", \"--\"]\n\n# Comando de inicio\nCMD [\"node\", \"src/server.js\"]\n