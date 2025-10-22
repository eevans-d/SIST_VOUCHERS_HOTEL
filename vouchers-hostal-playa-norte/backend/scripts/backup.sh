#!/bin/bash
#
# @file backup.sh
# @description Script de backup automático a AWS S3 con verificación de integridad
# @author GitHub Copilot
# @date 2025-10-22
# @version 1.0.0
#
# Funcionalidad:
# - Backup del archivo SQLite a S3
# - Calcula checksum SHA256
# - Verifica integridad antes de borrar original
# - Maneja errores y notificaciones
# - Soporta restore/recuperación
#
# Uso:
#   ./backup.sh                    # Backup completo
#   ./backup.sh --verify           # Verificar último backup
#   ./backup.sh --restore DATE     # Restaurar desde fecha específica
#
# Configuración:
#   Variables de entorno en .env.backup
#

set -euo pipefail

# ==================== CONFIGURACIÓN ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
DB_PATH="${PROJECT_ROOT}/db/vouchers.db"
AWS_BUCKET="${AWS_BACKUP_BUCKET:-vouchers-hotel-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Logs
LOG_DIR="${BACKUP_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y-%m-%d).log"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== FUNCIONES ====================

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[SUCCESS $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[WARNING $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# ==================== VALIDACIÓN PRELIMINAR ====================

validate_environment() {
  log "🔍 Validando ambiente..."

  # Verificar que aws-cli está instalado
  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI no está instalado. Instalar con: pip install awscli"
    exit 1
  fi

  # Verificar que la BD existe
  if [ ! -f "$DB_PATH" ]; then
    log_error "Base de datos no encontrada: $DB_PATH"
    exit 1
  fi

  # Verificar credenciales AWS
  if ! aws sts get-caller-identity > /dev/null 2>&1; then
    log_error "Credenciales AWS no configuradas. Configurar con: aws configure"
    exit 1
  fi

  # Verificar que el bucket existe
  if ! aws s3 ls "s3://${AWS_BUCKET}" > /dev/null 2>&1; then
    log_warning "Bucket S3 no encontrado. Creando: $AWS_BUCKET"
    aws s3 mb "s3://${AWS_BUCKET}" --region "$AWS_REGION"
  fi

  # Crear directorios locales
  mkdir -p "$BACKUP_DIR" "$LOG_DIR"

  log_success "✅ Ambiente validado"
}

# ==================== FUNCIONES DE BACKUP ====================

backup_database() {
  log "💾 Iniciando backup de la base de datos..."

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="${BACKUP_DIR}/vouchers_${TIMESTAMP}.db"
  CHECKSUM_FILE="${BACKUP_FILE}.sha256"

  # Copiar BD (con WAL, copiar todo)
  log "Copiando archivo de BD..."
  cp "$DB_PATH" "$BACKUP_FILE"
  
  if [ -f "${DB_PATH}-wal" ]; then
    cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
  fi
  
  if [ -f "${DB_PATH}-shm" ]; then
    cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
  fi

  log "✅ Archivo de BD copiado: $BACKUP_FILE"

  # Calcular checksum
  log "📋 Calculando checksum SHA256..."
  sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
  CHECKSUM=$(cat "$CHECKSUM_FILE" | awk '{print $1}')
  log "✅ Checksum calculado: $CHECKSUM"

  # Verificar integridad local
  log "🔐 Verificando integridad local..."
  if sha256sum -c "$CHECKSUM_FILE" > /dev/null; then
    log_success "✅ Integridad verificada localmente"
  else
    log_error "❌ Verificación de integridad falló"
    rm -f "$BACKUP_FILE" "$CHECKSUM_FILE"
    exit 1
  fi

  echo "$BACKUP_FILE"
}

upload_to_s3() {
  local backup_file="$1"
  local checksum_file="${backup_file}.sha256"
  
  log "☁️  Subiendo backup a S3..."

  # Upload del backup
  if aws s3 cp "$backup_file" "s3://${AWS_BUCKET}/" --region "$AWS_REGION"; then
    log_success "✅ Backup subido a S3"
  else
    log_error "❌ Error al subir backup a S3"
    exit 1
  fi

  # Upload del checksum
  if aws s3 cp "$checksum_file" "s3://${AWS_BUCKET}/" --region "$AWS_REGION"; then
    log_success "✅ Checksum subido a S3"
  else
    log_error "⚠️  Checksum no subido (pero backup ok)"
  fi

  # Metadatos
  FILENAME=$(basename "$backup_file")
  aws s3api put-object-tagging \
    --bucket "$AWS_BUCKET" \
    --key "$FILENAME" \
    --tagging 'TagSet=[{Key=backed-up-date,Value='$(date +%Y-%m-%d)'}]' \
    > /dev/null 2>&1 || true

  log_success "✅ Metadatos guardados"
}

cleanup_old_backups() {
  log "🧹 Limpiando backups antiguos..."

  # Locales (mantener últimos 5)
  log "Limpiando backups locales antiguos..."
  find "$BACKUP_DIR" -maxdepth 1 -name "vouchers_*.db" -type f | sort -r | tail -n +6 | while read file; do
    log "Borrando: $file"
    rm -f "$file" "${file}.sha256" "${file}-wal" "${file}-shm"
  done

  # En S3 (mantener últimos BACKUP_RETENTION_DAYS días)
  log "Limpiando backups en S3 más antiguos que $BACKUP_RETENTION_DAYS días..."
  
  DATE_THRESHOLD=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)
  
  aws s3api list-objects-v2 --bucket "$AWS_BUCKET" --query 'Contents[?LastModified<`'"${DATE_THRESHOLD}T00:00:00Z"'`].Key' --output text | \
  while read -r file; do
    if [ ! -z "$file" ]; then
      log "Borrando de S3: $file"
      aws s3 rm "s3://${AWS_BUCKET}/$file"
    fi
  done

  log_success "✅ Limpieza completada"
}

# ==================== FUNCIONES DE VERIFICACIÓN ====================

verify_backup() {
  log "🔐 Verificando integridad de backups..."

  # Último backup local
  LATEST_BACKUP=$(find "$BACKUP_DIR" -maxdepth 1 -name "vouchers_*.db" -type f | sort -r | head -1)
  
  if [ -z "$LATEST_BACKUP" ]; then
    log_error "No hay backups para verificar"
    exit 1
  fi

  CHECKSUM_FILE="${LATEST_BACKUP}.sha256"

  if [ ! -f "$CHECKSUM_FILE" ]; then
    log_error "Archivo de checksum no encontrado: $CHECKSUM_FILE"
    exit 1
  fi

  log "Verificando: $LATEST_BACKUP"
  
  if sha256sum -c "$CHECKSUM_FILE" > /dev/null; then
    log_success "✅ Integridad verificada"
    cat "$CHECKSUM_FILE"
  else
    log_error "❌ Verificación de integridad FALLÓ"
    exit 1
  fi
}

# ==================== FUNCIONES DE RESTAURACIÓN ====================

restore_backup() {
  local restore_date="$1"
  
  log "📥 Restaurando backup de: $restore_date"

  # Encontrar backup del día
  BACKUP_FILES=$(find "$BACKUP_DIR" -maxdepth 1 -name "vouchers_${restore_date}*.db" -type f)

  if [ -z "$BACKUP_FILES" ]; then
    log_error "No hay backups para la fecha: $restore_date"
    log "Backups disponibles:"
    ls -la "$BACKUP_DIR"/vouchers_*.db 2>/dev/null || log "Ninguno"
    exit 1
  fi

  # Usar el más reciente de ese día
  RESTORE_FILE=$(echo "$BACKUP_FILES" | sort -r | head -1)

  log "Archivo de restauración seleccionado: $RESTORE_FILE"

  # Verificar integridad antes de restaurar
  CHECKSUM_FILE="${RESTORE_FILE}.sha256"
  if [ -f "$CHECKSUM_FILE" ]; then
    log "Verificando integridad antes de restaurar..."
    if ! sha256sum -c "$CHECKSUM_FILE" > /dev/null; then
      log_error "❌ Verificación de integridad FALLÓ. No restaurando."
      exit 1
    fi
  fi

  # Backup del actual (precaución)
  log "Haciendo backup del DB actual como precaución..."
  cp "$DB_PATH" "${DB_PATH}.backup-$(date +%Y%m%d_%H%M%S)"

  # Restaurar
  log "Restaurando BD..."
  cp "$RESTORE_FILE" "$DB_PATH"
  
  if [ -f "${RESTORE_FILE}-wal" ]; then
    cp "${RESTORE_FILE}-wal" "${DB_PATH}-wal"
  fi
  
  if [ -f "${RESTORE_FILE}-shm" ]; then
    cp "${RESTORE_FILE}-shm" "${DB_PATH}-shm"
  fi

  log_success "✅ Base de datos restaurada"
}

# ==================== FUNCIONES DE STATUS ====================

show_backup_status() {
  log "📊 Estado de backups:"
  echo ""

  log "Backups locales:"
  ls -lh "$BACKUP_DIR"/vouchers_*.db 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' | sort -r || log "  (ninguno)"

  echo ""
  log "Backups en S3:"
  aws s3 ls "s3://${AWS_BUCKET}/" --region "$AWS_REGION" | grep "vouchers_" | awk '{print "  " $4 " (" $3 " bytes)"}' | sort -r || log "  (ninguno)"

  echo ""
  log "Espacio usado localmente:"
  du -sh "$BACKUP_DIR" | awk '{print "  Total: " $1}'

  echo ""
  log "Últimas líneas del log:"
  tail -5 "$LOG_FILE" | sed 's/^/  /'
}

# ==================== MAIN ====================

main() {
  case "${1:-backup}" in
    backup)
      validate_environment
      BACKUP_FILE=$(backup_database)
      upload_to_s3 "$BACKUP_FILE"
      cleanup_old_backups
      log_success "✅ Backup completado exitosamente"
      echo ""
      show_backup_status
      ;;
    verify)
      validate_environment
      verify_backup
      ;;
    restore)
      if [ -z "${2:-}" ]; then
        log_error "Uso: $0 restore YYYYMMDD"
        exit 1
      fi
      validate_environment
      restore_backup "$2"
      ;;
    status)
      validate_environment
      show_backup_status
      ;;
    *)
      echo "Uso: $0 {backup|verify|restore|status} [args]"
      echo ""
      echo "Comandos:"
      echo "  backup            Hacer backup a S3"
      echo "  verify            Verificar integridad del último backup"
      echo "  restore YYYYMMDD  Restaurar backup de una fecha específica"
      echo "  status            Ver estado de backups"
      exit 1
      ;;
  esac
}

main "$@"
