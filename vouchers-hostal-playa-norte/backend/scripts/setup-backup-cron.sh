#!/bin/bash
#
# @file setup-backup-cron.sh
# @description Configura el cron para backups automáticos cada 6 horas
# @author GitHub Copilot
# @date 2025-10-22
#
# Uso:
#   chmod +x scripts/setup-backup-cron.sh
#   ./scripts/setup-backup-cron.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
CRON_JOB="0 */6 * * * cd ${SCRIPT_DIR}/.. && bash ${BACKUP_SCRIPT} backup >> /tmp/backup.log 2>&1"

echo "📋 Configurando cron para backups automáticos..."

# Hacer el script ejecutable
chmod +x "$BACKUP_SCRIPT"

# Verificar si ya existe en cron
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
  echo "✅ Cron ya está configurado"
  crontab -l | grep "$BACKUP_SCRIPT"
else
  # Agregar a crontab (crear si no existe)
  ( crontab -l 2>/dev/null || true; echo "$CRON_JOB" ) | crontab -
  echo "✅ Cron configurado exitosamente"
  echo ""
  echo "Detalle:"
  echo "  • Cada 6 horas (0:00, 6:00, 12:00, 18:00)"
  echo "  • Ejecuta: backup.sh backup"
  echo "  • Logs: /tmp/backup.log"
  echo ""
  crontab -l | grep "$BACKUP_SCRIPT"
fi

echo ""
echo "Para verificar:"
echo "  crontab -l | grep backup.sh"
echo ""
echo "Para editar:"
echo "  crontab -e"
echo ""
echo "Para ver logs:"
echo "  tail -f /tmp/backup.log"
