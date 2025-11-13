import { getDb } from '../config/database.js';
import { logger, auditLogger } from '../config/logger.js';
import { voucherService } from './voucherService.js';
// Extraemos lógica detallada a helpers para reducir líneas y complejidad
import { handleRedemption } from './sync.helpers.js';

class SyncService {
  /**
   * Sincroniza canjes offline pendientes
   */
  async syncRedemptions({ device_id, redemptions, correlation_id, user_id }) {
    const db = getDb(), startTime = Date.now();
    logger.info({ event: 'sync_redemptions_start', correlation_id, device_id, redemption_count: redemptions.length });
    const results = [], conflicts = []; let successCount = 0, conflictCount = 0, errorCount = 0;
    const context = { voucherService, db, device_id, correlation_id, user_id, logger };
    for (const redemption of redemptions) {
      const { result, conflict, counters } = await handleRedemption({ redemption, context });
      results.push(result); if (conflict) conflicts.push(conflict);
      successCount += counters.success; conflictCount += counters.conflict; errorCount += counters.error;
    }
    const duration = Date.now() - startTime;
    auditLogger.info({ event: 'sync_completed', correlation_id, user_id, device_id, total_redemptions: redemptions.length, success_count: successCount, conflict_count: conflictCount, error_count: errorCount, duration_ms: duration });
    logger.info({ event: 'sync_redemptions_complete', correlation_id, device_id, success_count: successCount, conflict_count: conflictCount, error_count: errorCount, duration_ms: duration });
    return { success: true, summary: { total: redemptions.length, synced: successCount, conflicts: conflictCount, errors: errorCount }, results, conflicts: conflicts.length ? conflicts : undefined };
  }

  /**
   * Obtiene historial de sincronización de un dispositivo
   */
  async getSyncHistory({ device_id, limit = 100, _correlation_id }) {
    const db = getDb();

    const history = db
      .prepare(
        `
      SELECT * FROM sync_log
      WHERE device_id = ?
      ORDER BY synced_at DESC
      LIMIT ?
    `
      )
      .all(device_id, limit);

    return {
      device_id,
      history: history.map((record) => ({
        ...record,
        payload: JSON.parse(record.payload)
      }))
    };
  }

  /**
   * Obtiene estadísticas de sincronización
   */
  async getSyncStats({ device_id, from_date, to_date, _correlation_id }) {
    const db = getDb();

    let query = `
      SELECT
        result,
        COUNT(*) as count,
        DATE(synced_at) as sync_date
      FROM sync_log
      WHERE device_id = ?
    `;

    const params = [device_id];

    if (from_date) {
      query += ' AND DATE(synced_at) >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND DATE(synced_at) <= ?';
      params.push(to_date);
    }

    query += ' GROUP BY result, DATE(synced_at) ORDER BY sync_date DESC';

    const stats = db.prepare(query).all(...params);

    return {
      device_id,
      period: { from: from_date, to: to_date },
      stats
    };
  }
}

export { SyncService };
export const syncService = new SyncService();
