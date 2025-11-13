/**
 * Helpers para ReportService
 * Extraídos para cumplir max-lines-per-function
 */

export function validateDateRange(from_date, to_date) {
  if (from_date && to_date && new Date(from_date) > new Date(to_date)) {
    throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
  }
}

export function buildRedemptionsQuery(from_date, to_date, cafeteria_id) {
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

  return { query, params };
}

export function generateCSV(redemptions) {
  const csvHeader =
    'code,guest_name,room,redeemed_at,cafeteria,device_id,origin\n';
  const csvRows = redemptions
    .map(
      (r) =>
        `${r.code},${r.guest_name},${r.room},${r.redeemed_at},${r.cafeteria},${r.device_id},${r.origin}`
    )
    .join('\n');

  return csvHeader + csvRows;
}

export function fetchTodayStats(db, today) {
  return db
    .prepare(
      `
    SELECT
      COUNT(DISTINCT v.id) as vouchers_emitted,
      COUNT(DISTINCT r.id) as vouchers_redeemed,
      COUNT(DISTINCT CASE WHEN r.sync_status = 'synced' THEN r.id END) as online_redemptions,
      COUNT(DISTINCT CASE WHEN r.sync_status != 'synced' THEN r.id END) as offline_redemptions
    FROM vouchers v
    LEFT JOIN redemptions r ON v.id = r.voucher_id AND DATE(r.redeemed_at) = ?
    WHERE DATE(v.created_at) = ?
  `
    )
    .get(today, today);
}

export function fetchActiveVouchersCount(db) {
  return db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM vouchers
    WHERE status = 'active'
      AND DATE(valid_from) <= DATE('now', 'localtime')
      AND DATE(valid_until) >= DATE('now', 'localtime')
  `
    )
    .get();
}

export function fetchRecentConflictsCount(db) {
  return db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM sync_log
    WHERE result = 'conflict'
      AND DATE(synced_at) >= DATE('now', '-7 days')
  `
    )
    .get();
}

export function fetchActiveDevicesCount(db) {
  return db
    .prepare(
      `
    SELECT COUNT(DISTINCT device_id) as count
    FROM sync_log
    WHERE DATE(synced_at) >= DATE('now', '-1 day')
  `
    )
    .get();
}
