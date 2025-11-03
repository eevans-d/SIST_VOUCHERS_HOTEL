import { getDb } from '../config/database.js';
import { logger, auditLogger } from '../config/logger.js';
import { voucherService } from './voucherService.js';
import { ConflictError } from '../middleware/errorHandler.js';

class SyncService {
  /**
   * Sincroniza canjes offline pendientes
   */
  async syncRedemptions({ device_id, redemptions, correlation_id, user_id }) {
    const db = getDb();
    const startTime = Date.now();

    logger.info({
      event: 'sync_redemptions_start',
      correlation_id,
      device_id,
      redemption_count: redemptions.length
    });

    const results = [];
    const conflicts = [];
    let successCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    for (const redemption of redemptions) {
      try {
        // Validar estructura
        if (!redemption.local_id || !redemption.voucher_code) {
          results.push({
            local_id: redemption.local_id,
            status: 'error',
            reason: 'INVALID_STRUCTURE'
          });
          errorCount++;
          continue;
        }

        // Intentar canjear
        const result = await voucherService.redeemVoucher({
          code: redemption.voucher_code,
          cafeteria_id: redemption.cafeteria_id,
          device_id: device_id,
          correlation_id: `${correlation_id}-${redemption.local_id}`,
          user_id
        });

        // Registrar en sync_log
        db.prepare(
          `
          INSERT INTO sync_log (            device_id, operation, payload, result, synced_at          ) VALUES (?, 'redemption', ?, 'success', datetime('now', 'localtime'))
        `
        ).run(device_id, JSON.stringify(redemption), 'success');

        results.push({
          local_id: redemption.local_id,
          status: 'synced',
          redemption_id: result.redemption.redemption_id,
          server_timestamp: result.redemption.redeemed_at
        });

        successCount++;
      } catch (error) {
        if (error instanceof ConflictError) {
          // Conflicto: voucher ya canjeado
          logger.warn({
            event: 'sync_conflict_detected',
            correlation_id,
            local_id: redemption.local_id,
            voucher_code: redemption.voucher_code,
            conflict_details: error.details
          });

          // Registrar conflicto
          db.prepare(
            `
            INSERT INTO sync_log (              device_id, operation, payload, result, synced_at            ) VALUES (?, 'redemption', ?, 'conflict', datetime('now', 'localtime'))
          `
          ).run(device_id, JSON.stringify(redemption));

          const conflictResult = {
            local_id: redemption.local_id,
            status: 'conflict',
            reason: 'ALREADY_REDEEMED',
            server_timestamp: error.details.redeemed_at,
            cafeteria: error.details.cafeteria,
            device: error.details.device,
            local_timestamp: redemption.local_timestamp
          };

          results.push(conflictResult);
          conflicts.push(conflictResult);
          conflictCount++;
        } else {
          // Otro error
          logger.error({
            event: 'sync_redemption_error',
            correlation_id,
            local_id: redemption.local_id,
            voucher_code: redemption.voucher_code,
            error: error.message
          });

          db.prepare(
            `
            INSERT INTO sync_log (              device_id, operation, payload, result, synced_at            ) VALUES (?, 'redemption', ?, 'error', datetime('now', 'localtime'))
          `
          ).run(device_id, JSON.stringify(redemption));

          results.push({
            local_id: redemption.local_id,
            status: 'error',
            reason: error.message
          });
          errorCount++;
        }
      }
    }

    // Auditoría del sync
    auditLogger.info({
      event: 'sync_completed',
      correlation_id,
      user_id,
      device_id,
      total_redemptions: redemptions.length,
      success_count: successCount,
      conflict_count: conflictCount,
      error_count: errorCount,
      duration_ms: Date.now() - startTime
    });

    logger.info({
      event: 'sync_redemptions_complete',
      correlation_id,
      device_id,
      success_count: successCount,
      conflict_count: conflictCount,
      error_count: errorCount,
      duration_ms: Date.now() - startTime
    });

    return {
      success: true,
      summary: {
        total: redemptions.length,
        synced: successCount,
        conflicts: conflictCount,
        errors: errorCount
      },
      results,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Obtiene historial de sincronización de un dispositivo
   */
  async getSyncHistory({ device_id, limit = 100, correlation_id }) {
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
  async getSyncStats({ device_id, from_date, to_date, correlation_id }) {
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
