import { getDb } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { CryptoService } from '../cryptoService.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
// Ajuste: se usa la versión modular get.js (voucherCore legado eliminado)
import { getVoucherLogic } from './get.js';

export async function validateVoucherLogic({ code, hmac, correlation_id }) {
  const db = getDb();
  const startTime = Date.now();
  logger.debug({ event: 'validate_voucher_start', correlation_id, code });
  const voucher = await getVoucherLogic({ code });
  if (!voucher) throw new NotFoundError('Voucher');
  if (hmac) {
    const isValidHMAC = CryptoService.verifyVoucherHMAC(voucher.code, voucher.valid_from, voucher.valid_until, voucher.stay_id, hmac);
    if (!isValidHMAC) { logger.warn({ event: 'validate_voucher_invalid_hmac', correlation_id, code }); throw new ValidationError('Firma HMAC inválida'); }
  }
  if (voucher.status !== 'active') {
    return { valid: false, reason: `VOUCHER_${voucher.status.toUpperCase()}`, voucher: { code: voucher.code, status: voucher.status, guest_name: voucher.guest_name, room: voucher.room_number } };
  }
  const now = new Date();
  const validFrom = new Date(voucher.valid_from + 'T00:00:00-03:00');
  const validUntil = new Date(voucher.valid_until + 'T23:59:59-03:00');
  if (now < validFrom) return { valid: false, reason: 'VOUCHER_NOT_YET_VALID', valid_from: voucher.valid_from };
  if (now > validUntil) {
    db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run('expired', voucher.id);
    return { valid: false, reason: 'VOUCHER_EXPIRED', valid_until: voucher.valid_until };
  }
  if (voucher.is_redeemed) {
    return { valid: false, reason: 'VOUCHER_ALREADY_REDEEMED', redeemed_at: voucher.redemption.redeemed_at, cafeteria: voucher.redemption.cafeteria_name };
  }
  logger.info({ event: 'validate_voucher_success', correlation_id, code, duration_ms: Date.now() - startTime });
  return { valid: true, voucher: { code: voucher.code, guest_name: voucher.guest_name, room: voucher.room_number, valid_from: voucher.valid_from, valid_until: voucher.valid_until, status: voucher.status } };
}
