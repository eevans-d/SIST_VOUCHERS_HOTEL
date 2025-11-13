import { getDb } from '../config/database.js';
import { logger } from '../config/logger.js';
// import { ValidationError } from '../middleware/errorHandler.js';
import {
  validateDateRange,
  buildRedemptionsQuery,
  generateCSV,
  fetchTodayStats,
  fetchActiveVouchersCount,
  fetchRecentConflictsCount,
  fetchActiveDevicesCount
} from './helpers/report.helpers.js';

class ReportService {
  /**
   * Genera CSV de redenciones
   */
  async generateRedemptionsCSV({ from_date, to_date, cafeteria_id, correlation_id }) {
    const db = getDb();
    const startTime = Date.now();

    logger.info({
      event: 'generate_csv_start',
      correlation_id,
      from_date,
      to_date
    });

    validateDateRange(from_date, to_date);

    const { query, params } = buildRedemptionsQuery(from_date, to_date, cafeteria_id);
    const redemptions = db.prepare(query).all(...params);
    const csv = generateCSV(redemptions);

    logger.info({
      event: 'generate_csv_complete',
      correlation_id,
      row_count: redemptions.length,
      duration_ms: Date.now() - startTime
    });

    return {
      csv,
      metadata: {
        total_redemptions: redemptions.length,
        period: { from: from_date, to: to_date },
        generated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Genera reporte de vouchers emitidos vs canjeados
   */
  async getReconciliationReport({ from_date, to_date, _correlation_id }) {
    const db = getDb();

    const stats = db
      .prepare(
        `
      SELECT
        DATE(v.created_at) as date,
        COUNT(DISTINCT v.id) as emitted,
        COUNT(DISTINCT r.id) as redeemed,
        COUNT(DISTINCT CASE WHEN v.status = 'expired' THEN v.id END) as expired,
        COUNT(DISTINCT CASE WHEN v.status = 'cancelled' THEN v.id END) as cancelled
      FROM vouchers v
      LEFT JOIN redemptions r ON v.id = r.voucher_id
      WHERE DATE(v.created_at) >= ? AND DATE(v.created_at) <= ?
      GROUP BY DATE(v.created_at)
      ORDER BY date DESC
    `
      )
      .all(from_date, to_date);

    const summary = db
      .prepare(
        `
      SELECT
        COUNT(DISTINCT v.id) as total_emitted,
        COUNT(DISTINCT r.id) as total_redeemed,
        COUNT(DISTINCT CASE WHEN v.status = 'expired' THEN v.id END) as total_expired,
        COUNT(DISTINCT CASE WHEN v.status = 'cancelled' THEN v.id END) as total_cancelled,
        COUNT(DISTINCT CASE WHEN v.status = 'active' THEN v.id END) as total_active
      FROM vouchers v
      LEFT JOIN redemptions r ON v.id = r.voucher_id
      WHERE DATE(v.created_at) >= ? AND DATE(v.created_at) <= ?
    `
      )
      .get(from_date, to_date);

    return {
      period: { from: from_date, to: to_date },
      summary,
      daily_stats: stats
    };
  }

  /**
   * Obtiene métricas operativas
   */
  async getOperationalMetrics({ _correlation_id }) {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const todayStats = fetchTodayStats(db, today);
    const activeVouchers = fetchActiveVouchersCount(db);
    const recentConflicts = fetchRecentConflictsCount(db);
    const activeDevices = fetchActiveDevicesCount(db);

    return {
      today: todayStats,
      active_vouchers: activeVouchers.count,
      recent_conflicts: recentConflicts.count,
      active_devices: activeDevices.count,
      timestamp: new Date().toISOString()
    };
  }
}

export { ReportService };
export const reportService = new ReportService();
