const Voucher = require('../entities/Voucher');

/**
 * VoucherRepository - Gestiona persistencia de vouchers
 * 
 * Responsabilidades:
 * - CRUD de vouchers
 * - Consultas complejas (por código, estado, rango de fechas)
 * - Validación y redención atómica
 * - Reportes de ocupación
 * 
 * @class VoucherRepository
 */
class VoucherRepository {
  /**
   * @param {Database} database - Instancia de better-sqlite3
   */
  constructor(database) {
    this.db = database;
  }

  /**
   * Obtiene un voucher por ID
   * 
   * @param {string} id - UUID del voucher
   * @returns {Voucher|null} Voucher encontrado o null
   */
  findById(id) {
    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(id);

    if (!row) {
      return null;
    }

    return this._hydrateVoucher(row);
  }

  /**
   * Obtiene un voucher por código
   * Muy usado en validación de canje
   * 
   * @param {string} code - Código del voucher
   * @returns {Voucher|null} Voucher encontrado o null
   */
  findByCode(code) {
    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE code = ?
    `;

    const row = this.db.prepare(sql).get(code);

    if (!row) {
      return null;
    }

    return this._hydrateVoucher(row);
  }

  /**
   * Obtiene todos los vouchers de una estadía
   * 
   * @param {string} stayId - ID de la estadía
   * @returns {Voucher[]} Array de vouchers
   */
  findByStayId(stayId) {
    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE stayId = ?
      ORDER BY createdAt DESC
    `;

    const rows = this.db.prepare(sql).all(stayId);
    return rows.map((row) => this._hydrateVoucher(row));
  }

  /**
   * Obtiene vouchers por estado
   * Útil para reportes y monitoreo
   * 
   * @param {string} status - Estado a filtrar (pending, active, redeemed, etc.)
   * @param {number} [limit=100] - Cantidad máxima
   * @param {number} [offset=0] - Offset para paginación
   * @returns {Object} {vouchers: Voucher[], total: number}
   */
  findByStatus(status, limit = 100, offset = 0) {
    const sqlCount = `SELECT COUNT(*) as total FROM vouchers WHERE status = ?`;
    const countResult = this.db.prepare(sqlCount).get(status);

    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE status = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(sql).all(status, limit, offset);

    return {
      vouchers: rows.map((row) => this._hydrateVoucher(row)),
      total: countResult.total,
    };
  }

  /**
   * Obtiene vouchers en rango de fechas
   * 
   * @param {Date} startDate - Fecha inicial (inclusive)
   * @param {Date} endDate - Fecha final (inclusive)
   * @returns {Voucher[]} Array de vouchers en el rango
   */
  findByDateRange(startDate, endDate) {
    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE createdAt >= ? AND createdAt <= ?
      ORDER BY createdAt DESC
    `;

    const rows = this.db.prepare(sql).all(
      startDate.toISOString(),
      endDate.toISOString()
    );

    return rows.map((row) => this._hydrateVoucher(row));
  }

  /**
   * Obtiene vouchers canjeados en una fecha específica
   * 
   * @param {Date} date - Fecha a buscar
   * @returns {Voucher[]} Array de vouchers canjeados ese día
   */
  findRedeemedByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE status = 'redeemed'
        AND DATE(redemptionDate) = DATE(?)
      ORDER BY redemptionDate DESC
    `;

    const rows = this.db.prepare(sql).all(date.toISOString());
    return rows.map((row) => this._hydrateVoucher(row));
  }

  /**
   * Crea y persiste un nuevo voucher
   * 
   * @param {Voucher} voucher - Instancia de Voucher
   * @returns {Voucher} Voucher con ID asignado
   * @throws {Error} Si ya existe un voucher con ese código
   */
  save(voucher) {
    const sql = `
      INSERT INTO vouchers 
        (id, stayId, code, qrCode, status, redemptionDate, 
         redemptionNotes, expiryDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      this.db.prepare(sql).run(
        voucher.id,
        voucher.stayId,
        voucher.code,
        voucher.qrCode || null,
        voucher.status,
        voucher.redemptionDate?.toISOString() || null,
        voucher.redemptionNotes || null,
        voucher.expiryDate?.toISOString(),
        voucher.createdAt.toISOString(),
        voucher.updatedAt.toISOString()
      );

      return voucher;
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        throw new Error(`Voucher con código '${voucher.code}' ya existe`);
      }
      throw error;
    }
  }

  /**
   * Actualiza un voucher existente
   * 
   * @param {Voucher} voucher - Voucher a actualizar
   * @returns {Voucher} Voucher actualizado
   */
  update(voucher) {
    const sql = `
      UPDATE vouchers
      SET stayId = ?, code = ?, qrCode = ?, status = ?, 
          redemptionDate = ?, redemptionNotes = ?, expiryDate = ?, updatedAt = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(
      voucher.stayId,
      voucher.code,
      voucher.qrCode || null,
      voucher.status,
      voucher.redemptionDate?.toISOString() || null,
      voucher.redemptionNotes || null,
      voucher.expiryDate?.toISOString(),
      voucher.updatedAt.toISOString(),
      voucher.id
    );

    return voucher;
  }

  /**
   * Valida y canjea un voucher de forma atómica
   * Verifica:
   * - Voucher existe
   * - Estadía existe y es válida
   * - Voucher está activo
   * - No ha expirado
   * 
   * @param {string} code - Código del voucher
   * @param {string} [notes] - Notas del canje
   * @returns {Voucher} Voucher canjeado
   * @throws {Error} Si validación falla
   */
  validateAndRedeem(code, notes = null) {
    return this.db.transaction(() => {
      const voucher = this.findByCode(code);

      if (!voucher) {
        throw new Error(`Voucher con código '${code}' no encontrado`);
      }

      if (!voucher.isValid()) {
        throw new Error(
          `Voucher no es válido. Estado actual: '${voucher.status}'`
        );
      }

      if (voucher.isExpired()) {
        voucher.expire();
        this.update(voucher);
        throw new Error(`Voucher expirado en ${voucher.expiryDate.toISOString()}`);
      }

      // Verificar que la estadía existe
      const sqlStay = 'SELECT id FROM stays WHERE id = ? AND status = "active"';
      const stay = this.db.prepare(sqlStay).get(voucher.stayId);

      if (!stay) {
        throw new Error(
          `Estadía '${voucher.stayId}' no existe o no está activa`
        );
      }

      // Realizar el canje
      voucher.redeem(notes);
      this.update(voucher);

      return voucher;
    })();
  }

  /**
   * Obtiene estadísticas de vouchers
   * 
   * @returns {Object} Estadísticas
   */
  getStats() {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        ROUND(
          (SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) * 100.0 / 
           COUNT(*)), 2
        ) as redemptionRate
      FROM vouchers
    `;

    const stats = this.db.prepare(sql).get();

    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      active: stats.active || 0,
      redeemed: stats.redeemed || 0,
      expired: stats.expired || 0,
      cancelled: stats.cancelled || 0,
      redemptionRate: stats.redemptionRate || 0,
    };
  }

  /**
   * Obtiene vouchers próximos a expirar (próximos 7 días)
   * 
   * @returns {Voucher[]} Array de vouchers próximos a expirar
   */
  findExpiringsoon() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const sql = `
      SELECT id, stayId, code, qrCode, status, redemptionDate, 
             redemptionNotes, expiryDate, createdAt, updatedAt
      FROM vouchers
      WHERE status = 'active'
        AND expiryDate >= ?
        AND expiryDate <= ?
      ORDER BY expiryDate ASC
    `;

    const rows = this.db.prepare(sql).all(now.toISOString(), sevenDaysFromNow.toISOString());

    return rows.map((row) => this._hydrateVoucher(row));
  }

  /**
   * Expira vouchers vencidos (job de limpieza)
   * 
   * @returns {number} Cantidad de vouchers expirados
   */
  expireOutdatedVouchers() {
    const now = new Date();

    const sql = `
      UPDATE vouchers
      SET status = 'expired', updatedAt = ?
      WHERE status = 'active' AND expiryDate < ?
    `;

    const result = this.db.prepare(sql).run(now.toISOString(), now.toISOString());

    return result.changes;
  }

  /**
   * Cancela vouchers de una estadía cancelada
   * 
   * @param {string} stayId - ID de la estadía
   * @returns {number} Cantidad de vouchers cancelados
   */
  cancelByStayId(stayId) {
    const now = new Date();

    const sql = `
      UPDATE vouchers
      SET status = 'cancelled', updatedAt = ?
      WHERE stayId = ? AND status != 'redeemed'
    `;

    const result = this.db.prepare(sql).run(now.toISOString(), stayId);

    return result.changes;
  }

  /**
   * Helper: Convierte fila de BD a instancia Voucher
   * 
   * @private
   * @param {Object} row - Fila de BD
   * @returns {Voucher} Instancia de Voucher
   */
  _hydrateVoucher(row) {
    return new Voucher({
      id: row.id,
      stayId: row.stayId,
      code: row.code,
      qrCode: row.qrCode,
      status: row.status,
      redemptionDate: row.redemptionDate ? new Date(row.redemptionDate) : null,
      redemptionNotes: row.redemptionNotes,
      expiryDate: new Date(row.expiryDate),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}

module.exports = VoucherRepository;
