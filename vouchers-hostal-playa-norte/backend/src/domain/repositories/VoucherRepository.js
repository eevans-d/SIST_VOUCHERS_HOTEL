import { Voucher } from '../entities/Voucher.js';

/**
 * VoucherRepository - Capa de persistencia para Vouchers
 * Gestiona todas las operaciones de BD de vouchers
 */
export class VoucherRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Buscar voucher por ID
   */
  findById(voucherId) {
    const query = 'SELECT * FROM vouchers WHERE id = ?';
    const voucher = this.db.prepare(query).get(voucherId);
    return voucher ? Voucher.fromDatabase(voucher) : null;
  }

  /**
   * Buscar voucher por código
   */
  findByCode(code) {
    const query = 'SELECT * FROM vouchers WHERE code = ?';
    const voucher = this.db.prepare(query).get(code);
    return voucher ? Voucher.fromDatabase(voucher) : null;
  }

  /**
   * Buscar vouchers por stay
   */
  findByStayId(stayId, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM vouchers 
      WHERE stayId = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const vouchers = this.db.prepare(query).all(stayId, limit, offset);
    return vouchers.map((v) => Voucher.fromDatabase(v));
  }

  /**
   * Buscar vouchers por estado
   */
  findByStatus(status, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM vouchers 
      WHERE status = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const vouchers = this.db.prepare(query).all(status, limit, offset);
    return vouchers.map((v) => Voucher.fromDatabase(v));
  }

  /**
   * Buscar vouchers activos que expiran pronto
   */
  findExpiringsSoon(daysThreshold = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    const query = `
      SELECT * FROM vouchers 
      WHERE status = 'active' 
      AND expiryDate <= ? 
      ORDER BY expiryDate ASC
    `;
    const vouchers = this.db.prepare(query).all(futureDate);
    return vouchers.map((v) => Voucher.fromDatabase(v));
  }

  /**
   * Buscar vouchers por rango de fechas
   */
  findByDateRange(startDate, endDate, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM vouchers 
      WHERE createdAt >= ? AND createdAt <= ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const vouchers = this.db
      .prepare(query)
      .all(startDate, endDate, limit, offset);
    return vouchers.map((v) => Voucher.fromDatabase(v));
  }

  /**
   * Buscar vouchers canjeados en un período
   */
  findRedeemedByDate(startDate, endDate) {
    const query = `
      SELECT * FROM vouchers 
      WHERE status = 'redeemed' 
      AND redemptionDate >= ? AND redemptionDate <= ?
      ORDER BY redemptionDate DESC
    `;
    const vouchers = this.db.prepare(query).all(startDate, endDate);
    return vouchers.map((v) => Voucher.fromDatabase(v));
  }

  /**
   * Guardar voucher (crear o actualizar)
   */
  save(voucher) {
    const data = voucher.toJSON();

    const existing = this.findById(data.id);
    if (existing) {
      return this.update(voucher);
    }

    const query = `
      INSERT INTO vouchers (
        id, stayId, code, qrCode, status,
        redemptionDate, expiryDate, redemptionNotes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(query)
      .run(
        data.id,
        data.stayId,
        data.code,
        data.qrCode,
        data.status,
        data.redemptionDate,
        data.expiryDate,
        data.redemptionNotes,
        data.createdAt,
        data.updatedAt
      );

    return data.id;
  }

  /**
   * Actualizar voucher
   */
  update(voucher) {
    const data = voucher.toJSON();

    const query = `
      UPDATE vouchers 
      SET stayId = ?, code = ?, qrCode = ?, status = ?,
          redemptionDate = ?, expiryDate = ?, 
          redemptionNotes = ?, updatedAt = ?
      WHERE id = ?
    `;

    this.db
      .prepare(query)
      .run(
        data.stayId,
        data.code,
        data.qrCode,
        data.status,
        data.redemptionDate,
        data.expiryDate,
        data.redemptionNotes,
        data.updatedAt,
        data.id
      );

    return data.id;
  }

  /**
   * Operación ATÓMICA: Validar Y canjear voucher en una transacción
   */
  validateAndRedeem(voucherCode, notes = '') {
    return this.db.transaction(() => {
      // 1. Buscar voucher
      const voucher = this.findByCode(voucherCode);
      if (!voucher) {
        throw new Error('Voucher no encontrado');
      }

      // 2. Validar estado
      if (voucher.status !== 'active') {
        throw new Error(`Voucher no está activo (estado: ${voucher.status})`);
      }

      // 3. Validar expiración
      if (voucher.isExpired()) {
        voucher.expire();
        this.update(voucher);
        throw new Error('Voucher expirado');
      }

      // 4. Canjear
      voucher.redeem(notes);
      this.update(voucher);

      return {
        success: true,
        voucherId: voucher.id,
        status: 'redeemed'
      };
    })();
  }

  /**
   * Validar múltiples vouchers en lote
   */
  validateAndRedeemBatch(voucherCodes, notes = '') {
    const results = {
      successful: [],
      failed: []
    };

    for (const code of voucherCodes) {
      try {
        const result = this.validateAndRedeem(code, notes);
        results.successful.push(result);
      } catch (error) {
        results.failed.push({
          code,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Expirar vouchers desactualizados
   */
  expireOutdatedVouchers() {
    const query = `
      SELECT * FROM vouchers 
      WHERE status = 'active' AND expiryDate < datetime('now')
    `;

    const expiredVouchers = this.db.prepare(query).all();

    return this.db.transaction(() => {
      let count = 0;
      for (const data of expiredVouchers) {
        const voucher = Voucher.fromDatabase(data);
        voucher.expire();
        this.update(voucher);
        count++;
      }
      return count;
    })();
  }

  /**
   * Cancelar todos los vouchers de una estadía
   */
  cancelByStayId(stayId, reason = 'Stay cancelled') {
    return this.db.transaction(() => {
      const vouchers = this.findByStayId(stayId, 1000);
      let count = 0;

      for (const voucher of vouchers) {
        if (['pending', 'active'].includes(voucher.status)) {
          voucher.cancel(reason);
          this.update(voucher);
          count++;
        }
      }

      return count;
    })();
  }

  /**
   * Obtener estadísticas de vouchers
   */
  getStats() {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM vouchers
    `;

    const stats = this.db.prepare(query).get();
    const redemptionRate =
      stats.total > 0 ? ((stats.redeemed / stats.total) * 100).toFixed(2) : 0;

    return {
      ...stats,
      redemptionRate: `${redemptionRate}%`
    };
  }

  /**
   * Eliminar voucher
   */
  delete(voucherId) {
    const query = 'DELETE FROM vouchers WHERE id = ?';
    this.db.prepare(query).run(voucherId);
  }
}
