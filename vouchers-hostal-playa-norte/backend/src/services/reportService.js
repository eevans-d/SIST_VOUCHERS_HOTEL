const { getDb } = require('../config/database');
const { logger } = require('../config/logger');
const { ValidationError } = require('../middleware/errorHandler');

class ReportService {
  /**
   * Genera reporte de canjes en formato CSV
   */
  async generateRedemptionsCSV({ from_date, to_date, cafeteria_id, correlation_id }) {
    const db = getDb();
    const startTime = Date.now();
    
    logger.info({
      event: 'generate_csv_start',
      correlation_id,
      from_date,
      to_date,
      cafeteria_id
    });

    // Validar fechas
    if (from_date && to_date && new Date(from_date) > new Date(to_date)) {
      throw new ValidationError('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    let query = `
      SELECT 
        v.code,
        s.guest_name,
        s.room_number as room,
        r.redeemed_at,
        c.name as cafeteria,
        r.device_id,
        CASE 
          WHEN r.sync_status = 'synced' THEN 'online'
          ELSE 'offline'
        END as origin
      FROM redemptions r
      JOIN vouchers v ON r.voucher_id = v.id
      JOIN stays s ON v.stay_id = s.id
      JOIN cafeterias c ON r.cafeteria_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (from_date) {
      query += ' AND DATE(r.redeemed_at) >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      query += ' AND DATE(r.redeemed_at) <= ?';
      params.push(to_date);
    }
    
    if (cafeteria_id) {
      query += ' AND r.cafeteria_id = ?';
      params.push(cafeteria_id);
    }
    
    query += ' ORDER BY r.redeemed_at DESC';
    
    const redemptions = db.prepare(query).all(...params);
    
    // Generar CSV
    const csvHeader = 'code,guest_name,room,redeemed_at,cafeteria,device_id,origin\n';
    const csvRows = redemptions.map(r => 
      `${r.code},${r.guest_name},${r.room},${r.redeemed_at},${r.cafeteria},${r.device_id},${r.origin}`
    ).join('\n');
    
    const csv = csvHeader + csvRows;
    
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
  async getReconciliationReport({ from_date, to_date, correlation_id }) {
    const db = getDb();
    
    const stats = db.prepare(`
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
    `).all(from_date, to_date);
    
    const summary = db.prepare(`
      SELECT 
        COUNT(DISTINCT v.id) as total_emitted,
        COUNT(DISTINCT r.id) as total_redeemed,
        COUNT(DISTINCT CASE WHEN v.status = 'expired' THEN v.id END) as total_expired,
        COUNT(DISTINCT CASE WHEN v.status = 'cancelled' THEN v.id END) as total_cancelled,
        COUNT(DISTINCT CASE WHEN v.status = 'active' THEN v.id END) as total_active
      FROM vouchers v
      LEFT JOIN redemptions r ON v.id = r.voucher_id
      WHERE DATE(v.created_at) >= ? AND DATE(v.created_at) <= ?
    `).get(from_date, to_date);
    
    return {
      period: { from: from_date, to: to_date },
      summary,
      daily_stats: stats
    };
  }

  /**
   * Obtiene métricas operativas
   */
  async getOperationalMetrics({ correlation_id }) {
    const db = getDb();
    
    // Métricas de hoy
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT v.id) as vouchers_emitted,
        COUNT(DISTINCT r.id) as vouchers_redeemed,
        COUNT(DISTINCT CASE WHEN r.sync_status = 'synced' THEN r.id END) as online_redemptions,
        COUNT(DISTINCT CASE WHEN r.sync_status != 'synced' THEN r.id END) as offline_redemptions
      FROM vouchers v
      LEFT JOIN redemptions r ON v.id = r.voucher_id AND DATE(r.redeemed_at) = ?
      WHERE DATE(v.created_at) = ?
    `).get(today, today);
    
    // Vouchers activos
    const activeVouchers = db.prepare(`
      SELECT COUNT(*) as count
      FROM vouchers
      WHERE status = 'active' 
        AND DATE(valid_from) <= DATE('now', 'localtime')
        AND DATE(valid_until) >= DATE('now', 'localtime')
    `).get();
    
    // Conflictos recientes (últimos 7 días)
    const recentConflicts = db.prepare(`
      SELECT COUNT(*) as count
      FROM sync_log
      WHERE result = 'conflict'
        AND DATE(synced_at) >= DATE('now', '-7 days')
    `).get();
    
    // Dispositivos activos
    const activeDevices = db.prepare(`
      SELECT COUNT(DISTINCT device_id) as count
      FROM sync_log
      WHERE DATE(synced_at) >= DATE('now', '-1 day')
    `).get();
    
    return {
      today: todayStats,
      active_vouchers: activeVouchers.count,
      recent_conflicts: recentConflicts.count,
      active_devices: activeDevices.count,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { ReportService: new ReportService() };
