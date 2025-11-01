import { Voucher } from '../../domain/entities/Voucher.js';

export class VoucherRepository {
  constructor(database) {
    this.db = database;
  }

  async findById(id) {
    const row = this.db.prepare('SELECT * FROM vouchers WHERE id = ?').get(id);
    return row ? Voucher.fromPersistence(row) : null;
  }

  async findByCode(code) {
    const row = this.db
      .prepare('SELECT * FROM vouchers WHERE code = ?')
      .get(code);
    return row ? Voucher.fromPersistence(row) : null;
  }

  async save(voucher) {
    const data = voucher.toPersistence();
    this.db
      .prepare(
        'INSERT INTO vouchers (id, code, stayId, validFrom, validUntil, hmacSignature, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        data.id,
        data.code,
        data.stayId,
        data.validFrom,
        data.validUntil,
        data.hmacSignature,
        data.status,
        data.createdAt,
        data.updatedAt
      );
  }

  async update(voucher) {
    const data = voucher.toPersistence();
    this.db
      .prepare('UPDATE vouchers SET status = ?, updatedAt = ? WHERE id = ?')
      .run(data.status, data.updatedAt, data.id);
  }
}

export default VoucherRepository;
