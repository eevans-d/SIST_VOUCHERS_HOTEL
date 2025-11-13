import { getDb } from '../../config/database.js';
import { logger, auditLogger } from '../../config/logger.js';
import { ConflictError, NotFoundError } from '../../middleware/errorHandler.js';

export function cancelVoucherLogic({ code, reason, user_id, correlation_id }) {
  const db = getDb();
  logger.info({ event: 'cancel_voucher_start', correlation_id, code, reason });
  const voucher = db.prepare('SELECT * FROM vouchers WHERE code = ?').get(code);
  if (!voucher) throw new NotFoundError('Voucher');
  if (voucher.status !== 'active') throw new ConflictError('Solo vouchers activos pueden cancelarse');
  db.prepare('UPDATE vouchers SET status = ?, cancellation_reason = ?, cancelled_at = datetime(\'now\', \'localtime\'), cancelled_by = ? WHERE id = ?').run('cancelled', reason || null, user_id || null, voucher.id);
  auditLogger.info({ event: 'voucher_cancelled', code, reason, user_id, correlation_id });
  logger.info({ event: 'cancel_voucher_success', correlation_id, code });
  return { success: true, code, status: 'cancelled' };
}
