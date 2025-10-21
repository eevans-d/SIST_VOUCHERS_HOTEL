#!/bin/bash

# Script de backup de base de datos
# Uso: ./backup-db.sh [destino]

set -e

# Configuración
DB_PATH="${DATABASE_PATH:-./vouchers.db}"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/vouchers_backup_${TIMESTAMP}.db"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Iniciando backup de base de datos...${NC}\n"

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"

# Verificar que existe la BD
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Error: Base de datos no encontrada en $DB_PATH${NC}"
    exit 1
fi

# Realizar backup
echo "📋 Base de datos: $DB_PATH"
echo "💾 Destino: $BACKUP_FILE"
echo ""

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Verificar backup
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup completado exitosamente${NC}"
    echo "   Tamaño: $SIZE"
    echo "   Archivo: $BACKUP_FILE"
    
    # Comprimir backup
    echo ""
    echo "🗜️  Comprimiendo backup..."
    gzip "$BACKUP_FILE"
    COMPRESSED="${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED" | cut -f1)
    echo -e "${GREEN}✅ Backup comprimido${NC}"
    echo "   Tamaño: $COMPRESSED_SIZE"
    echo "   Archivo: $COMPRESSED"
    
    # Limpiar backups antiguos (mantener últimos 7)
    echo ""
    echo "🧹 Limpiando backups antiguos..."
    ls -t "$BACKUP_DIR"/vouchers_backup_*.db.gz | tail -n +8 | xargs -r rm
    REMAINING=$(ls "$BACKUP_DIR"/vouchers_backup_*.db.gz 2>/dev/null | wc -l)
    echo "   Backups mantenidos: $REMAINING"
    
else
    echo -e "${RED}❌ Error: Backup falló${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Proceso completado${NC}"
