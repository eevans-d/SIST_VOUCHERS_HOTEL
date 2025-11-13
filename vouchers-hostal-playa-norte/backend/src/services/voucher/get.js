import { getDb } from '../../config/database.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

export function getVoucherLogic({ code }) {
  const db = getDb();
  const voucher = db.prepare('SELECT v.*, s.guest_name, s.room_number FROM vouchers v JOIN stays s ON v.stay_id = s.id WHERE v.code = ?').get(code);
  if (!voucher) throw new NotFoundError('Voucher');
  return voucher;
}
