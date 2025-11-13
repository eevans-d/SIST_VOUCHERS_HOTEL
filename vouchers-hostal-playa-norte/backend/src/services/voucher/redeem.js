import { getDb } from '../../config/database.js';
import { logger, auditLogger } from '../../config/logger.js';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler.js';

// Helper: obtiene voucher y valida estado inicial
function selectVoucherForRedemption(db, code) {
  const voucher = db.prepare('SELECT v.*, s.guest_name, s.room_number, v.valid_from, v.valid_until FROM vouchers v JOIN stays s ON v.stay_id = s.id WHERE v.code = ?').get(code);
  if (!voucher) throw new NotFoundError('Voucher');
  if (voucher.status !== 'active') throw new ValidationError(`Voucher en estado: ${voucher.status}`);
  return voucher;
}

// Helper: valida ventana temporal y actualiza expirados
function ensureVoucherTimeWindow(db, voucher) {
  const now = new Date();
  const validFrom = new Date(voucher.valid_from + 'T00:00:00-03:00');
  const validUntil = new Date(voucher.valid_until + 'T23:59:59-03:00');
  if (now < validFrom) throw new ValidationError('Voucher aún no es válido');
  if (now > validUntil) {
    db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run('expired', voucher.id);
    throw new ValidationError('Voucher expirado');
  }
}

// Helper: ejecuta inserción de canje y actualización de voucher
function performRedemption(db, voucher, { cafeteria_id, device_id, user_id, correlation_id }) {
  try {
    const redemptionResult = db
      .prepare('INSERT INTO redemptions (voucher_id, cafeteria_id, device_id, redeemed_at, redeemed_by, correlation_id) VALUES (?, ?, ?, datetime(\'now\', \'localtime\'), ?, ?)')
      .run(voucher.id, cafeteria_id, device_id, user_id, correlation_id);
    db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run('redeemed', voucher.id);
    return {
      redemption_id: redemptionResult.lastInsertRowid,
      voucher_code: voucher.code,
      guest_name: voucher.guest_name,
      room: voucher.room_number,
      redeemed_at: new Date().toISOString()
    };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const existing = db
        .prepare('SELECT r.redeemed_at, c.name as cafeteria_name, r.device_id FROM redemptions r JOIN cafeterias c ON r.cafeteria_id = c.id WHERE r.voucher_id = ?')
        .get(voucher.id);
      throw new ConflictError('Voucher ya canjeado', {
        redeemed_at: existing.redeemed_at,
        cafeteria: existing.cafeteria_name,
        device: existing.device_id
      });
    }
    throw error;
  }
}

export async function redeemVoucherLogic({ code, cafeteria_id, device_id, correlation_id, user_id }) {
  const db = getDb();
  const startTime = Date.now();
  logger.info({ event: 'redeem_voucher_start', correlation_id, code, cafeteria_id, device_id });

  const transaction = db.transaction(() => {
    const voucher = selectVoucherForRedemption(db, code);
    ensureVoucherTimeWindow(db, voucher);
    return performRedemption(db, voucher, { cafeteria_id, device_id, user_id, correlation_id });
  });

  try {
    const result = transaction();
    auditLogger.info({ event: 'voucher_redeemed', correlation_id, user_id, voucher_code: code, cafeteria_id, device_id, redemption_id: result.redemption_id, duration_ms: Date.now() - startTime });
    logger.info({ event: 'redeem_voucher_success', correlation_id, code, redemption_id: result.redemption_id, duration_ms: Date.now() - startTime });
    return { success: true, redemption: result };
  } catch (error) {
    logger.error({ event: 'redeem_voucher_failed', correlation_id, code, error: error.message, is_conflict: error instanceof ConflictError });
    throw error;
  }
}
