import { getDb } from '../../config/database.js';
import { logger, auditLogger } from '../../config/logger.js';
import { CryptoService } from '../cryptoService.js';
import { QRService } from '../qrService.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';

export async function emitVouchersLogic({ stay_id, valid_from, valid_until, breakfast_count, correlation_id, user_id }) {
  const db = getDb();
  const startTime = Date.now();
  logger.info({ event: 'emit_vouchers_start', correlation_id, stay_id, breakfast_count });

  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stay_id);
  if (!stay) throw new NotFoundError('Estadía');

  const validFromDate = new Date(valid_from);
  const validUntilDate = new Date(valid_until);
  const checkinDate = new Date(stay.checkin_date);
  const checkoutDate = new Date(stay.checkout_date);
  if (validFromDate < checkinDate || validUntilDate > checkoutDate) throw new ValidationError('Las fechas del voucher deben estar dentro del período de estadía');
  if (validFromDate > validUntilDate) throw new ValidationError('La fecha de inicio debe ser anterior a la fecha de fin');

  const vouchers = [];
  const transaction = db.transaction(() => {
    for (let i = 0; i < breakfast_count; i++) {
      const result = db.prepare('SELECT COUNT(*) as count FROM vouchers').get();
      const sequenceNumber = result.count + 1;
      const code = CryptoService.generateVoucherCode(sequenceNumber);
      const hmacSignature = CryptoService.generateVoucherHMAC(code, valid_from, valid_until, stay_id);
      const insertResult = db.prepare('INSERT INTO vouchers (code, stay_id, valid_from, valid_until, hmac_signature, status, created_at) VALUES (?, ?, ?, ?, ?, "active", datetime(\'now\', "localtime"))').run(code, stay_id, valid_from, valid_until, hmacSignature);
      vouchers.push({ id: insertResult.lastInsertRowid, code, hmac_signature: hmacSignature, valid_from, valid_until });
    }
  });

  try {
    transaction();
    const vouchersWithQR = await Promise.all(vouchers.map(async (v) => ({ ...v, ...(await QRService.generateVoucherQR(v)) })));
    auditLogger.info({ event: 'vouchers_emitted', correlation_id, user_id, stay_id, voucher_count: breakfast_count, voucher_codes: vouchers.map((v) => v.code), duration_ms: Date.now() - startTime });
    logger.info({ event: 'emit_vouchers_success', correlation_id, voucher_count: breakfast_count, duration_ms: Date.now() - startTime });
    return { success: true, vouchers: vouchersWithQR, stay: { guest_name: stay.guest_name, room_number: stay.room_number } };
  } catch (error) {
    logger.error({ event: 'emit_vouchers_failed', correlation_id, error: error.message, stack: error.stack });
    throw error;
  }
}
