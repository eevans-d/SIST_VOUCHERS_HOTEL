const { getDb } = require('../config/database');
const { logger, auditLogger } = require('../config/logger');
const { CryptoService } = require('./cryptoService');
const { QRService } = require('./qrService');
const {
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { formatInTimeZone } = require('date-fns-tz');

class VoucherService {
  /**
   * Emite nuevos vouchers para una estadía
   */
  async emitVouchers({
    stay_id,
    valid_from,
    valid_until,
    breakfast_count,
    correlation_id,
    user_id
  }) {
    const db = getDb();
    const startTime = Date.now();

    logger.info({
      event: 'emit_vouchers_start',
      correlation_id,
      stay_id,
      breakfast_count
    });

    // Validar estadía existe
    const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stay_id);
    if (!stay) {
      throw new NotFoundError('Estadía');
    }

    // Validar fechas
    const validFromDate = new Date(valid_from);
    const validUntilDate = new Date(valid_until);
    const checkinDate = new Date(stay.checkin_date);
    const checkoutDate = new Date(stay.checkout_date);

    if (validFromDate < checkinDate || validUntilDate > checkoutDate) {
      throw new ValidationError(
        'Las fechas del voucher deben estar dentro del período de estadía'
      );
    }

    if (validFromDate > validUntilDate) {
      throw new ValidationError(
        'La fecha de inicio debe ser anterior a la fecha de fin'
      );
    }

    const vouchers = [];

    const transaction = db.transaction(() => {
      for (let i = 0; i < breakfast_count; i++) {
        // Obtener siguiente número de secuencia
        const result = db
          .prepare('SELECT COUNT(*) as count FROM vouchers')
          .get();
        const sequenceNumber = result.count + 1;

        // Generar código único
        const code = CryptoService.generateVoucherCode(sequenceNumber);

        // Generar HMAC
        const hmacSignature = CryptoService.generateVoucherHMAC(
          code,
          valid_from,
          valid_until,
          stay_id
        );

        // Insertar voucher
        const insertResult = db
          .prepare(
            `
          INSERT INTO vouchers (code, stay_id, valid_from, valid_until, hmac_signature, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'active', datetime('now', 'localtime'))
        `
          )
          .run(code, stay_id, valid_from, valid_until, hmacSignature);

        vouchers.push({
          id: insertResult.lastInsertRowid,
          code,
          hmac_signature: hmacSignature,
          valid_from,
          valid_until
        });
      }
    });

    try {
      transaction();

      // Generar QRs para cada voucher
      const vouchersWithQR = await Promise.all(
        vouchers.map(async (voucher) => {
          const qr = await QRService.generateVoucherQR(voucher);
          return { ...voucher, ...qr };
        })
      );

      // Auditoría
      auditLogger.info({
        event: 'vouchers_emitted',
        correlation_id,
        user_id,
        stay_id,
        voucher_count: breakfast_count,
        voucher_codes: vouchers.map((v) => v.code),
        duration_ms: Date.now() - startTime
      });

      logger.info({
        event: 'emit_vouchers_success',
        correlation_id,
        voucher_count: breakfast_count,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        vouchers: vouchersWithQR,
        stay: {
          guest_name: stay.guest_name,
          room_number: stay.room_number
        }
      };
    } catch (error) {
      logger.error({
        event: 'emit_vouchers_failed',
        correlation_id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtiene información de un voucher
   */
  async getVoucher(code, correlation_id) {
    const db = getDb();

    const voucher = db
      .prepare(
        `
      SELECT v.*, s.guest_name, s.room_number, s.checkin_date, s.checkout_date
      FROM vouchers v
      JOIN stays s ON v.stay_id = s.id
      WHERE v.code = ?
    `
      )
      .get(code);

    if (!voucher) {
      throw new NotFoundError('Voucher');
    }

    // Verificar si está canjeado
    const redemption = db
      .prepare(
        `
      SELECT r.*, c.name as cafeteria_name
      FROM redemptions r
      JOIN cafeterias c ON r.cafeteria_id = c.id
      WHERE r.voucher_id = ?
    `
      )
      .get(voucher.id);

    return {
      ...voucher,
      is_redeemed: !!redemption,
      redemption: redemption || null
    };
  }

  /**
   * Valida un voucher sin canjearlo
   */
  async validateVoucher({ code, hmac, correlation_id }) {
    const db = getDb();
    const startTime = Date.now();

    logger.debug({
      event: 'validate_voucher_start',
      correlation_id,
      code
    });

    const voucher = await this.getVoucher(code, correlation_id);

    // Verificar HMAC si se proporciona
    if (hmac) {
      const isValidHMAC = CryptoService.verifyVoucherHMAC(
        voucher.code,
        voucher.valid_from,
        voucher.valid_until,
        voucher.stay_id,
        hmac
      );

      if (!isValidHMAC) {
        logger.warn({
          event: 'validate_voucher_invalid_hmac',
          correlation_id,
          code
        });
        throw new ValidationError('Firma HMAC inválida');
      }
    }

    // Validar estado
    if (voucher.status !== 'active') {
      return {
        valid: false,
        reason: `VOUCHER_${voucher.status.toUpperCase()}`,
        voucher: {
          code: voucher.code,
          status: voucher.status,
          guest_name: voucher.guest_name,
          room: voucher.room_number
        }
      };
    }

    // Validar fechas
    const now = new Date();
    const validFrom = new Date(voucher.valid_from + 'T00:00:00-03:00');
    const validUntil = new Date(voucher.valid_until + 'T23:59:59-03:00');

    if (now < validFrom) {
      return {
        valid: false,
        reason: 'VOUCHER_NOT_YET_VALID',
        valid_from: voucher.valid_from
      };
    }

    if (now > validUntil) {
      // Auto-expirar
      db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run(
        'expired',
        voucher.id
      );

      return {
        valid: false,
        reason: 'VOUCHER_EXPIRED',
        valid_until: voucher.valid_until
      };
    }

    // Verificar si ya fue canjeado
    if (voucher.is_redeemed) {
      return {
        valid: false,
        reason: 'VOUCHER_ALREADY_REDEEMED',
        redeemed_at: voucher.redemption.redeemed_at,
        cafeteria: voucher.redemption.cafeteria_name
      };
    }

    logger.info({
      event: 'validate_voucher_success',
      correlation_id,
      code,
      duration_ms: Date.now() - startTime
    });

    return {
      valid: true,
      voucher: {
        code: voucher.code,
        guest_name: voucher.guest_name,
        room: voucher.room_number,
        valid_from: voucher.valid_from,
        valid_until: voucher.valid_until,
        status: voucher.status
      }
    };
  }

  /**
   * Canjea un voucher (transacción atómica)
   */
  async redeemVoucher({
    code,
    cafeteria_id,
    device_id,
    correlation_id,
    user_id
  }) {
    const db = getDb();
    const startTime = Date.now();

    logger.info({
      event: 'redeem_voucher_start',
      correlation_id,
      code,
      cafeteria_id,
      device_id
    });

    const transaction = db.transaction(() => {
      // 1. Obtener voucher con lock
      const voucher = db
        .prepare(
          `
        SELECT v.*, s.guest_name, s.room_number
        FROM vouchers v
        JOIN stays s ON v.stay_id = s.id
        WHERE v.code = ?
      `
        )
        .get(code);

      if (!voucher) {
        throw new NotFoundError('Voucher');
      }

      // 2. Validar estado
      if (voucher.status !== 'active') {
        throw new ValidationError(`Voucher en estado: ${voucher.status}`);
      }

      // 3. Validar fechas
      const now = new Date();
      const validFrom = new Date(voucher.valid_from + 'T00:00:00-03:00');
      const validUntil = new Date(voucher.valid_until + 'T23:59:59-03:00');

      if (now < validFrom) {
        throw new ValidationError('Voucher aún no es válido');
      }

      if (now > validUntil) {
        // Auto-expirar
        db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run(
          'expired',
          voucher.id
        );
        throw new ValidationError('Voucher expirado');
      }

      // 4. Intentar insertar canje (UNIQUE constraint previene duplicados)
      try {
        const redemptionResult = db
          .prepare(
            `
          INSERT INTO redemptions (voucher_id, cafeteria_id, device_id, redeemed_at, redeemed_by, correlation_id)
          VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?)
        `
          )
          .run(voucher.id, cafeteria_id, device_id, user_id, correlation_id);

        // 5. Actualizar estado del voucher
        db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run(
          'redeemed',
          voucher.id
        );

        return {
          redemption_id: redemptionResult.lastInsertRowid,
          voucher_code: voucher.code,
          guest_name: voucher.guest_name,
          room: voucher.room_number,
          redeemed_at: new Date().toISOString()
        };
      } catch (error) {
        // UNIQUE constraint violation
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          // Obtener información del canje existente
          const existing = db
            .prepare(
              `
            SELECT r.redeemed_at, c.name as cafeteria_name, r.device_id
            FROM redemptions r
            JOIN cafeterias c ON r.cafeteria_id = c.id
            WHERE r.voucher_id = ?
          `
            )
            .get(voucher.id);

          throw new ConflictError('Voucher ya canjeado', {
            redeemed_at: existing.redeemed_at,
            cafeteria: existing.cafeteria_name,
            device: existing.device_id
          });
        }
        throw error;
      }
    });

    try {
      const result = transaction();

      // Auditoría
      auditLogger.info({
        event: 'voucher_redeemed',
        correlation_id,
        user_id,
        voucher_code: code,
        cafeteria_id,
        device_id,
        redemption_id: result.redemption_id,
        duration_ms: Date.now() - startTime
      });

      logger.info({
        event: 'redeem_voucher_success',
        correlation_id,
        code,
        redemption_id: result.redemption_id,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        redemption: result
      };
    } catch (error) {
      logger.error({
        event: 'redeem_voucher_failed',
        correlation_id,
        code,
        error: error.message,
        is_conflict: error instanceof ConflictError
      });
      throw error;
    }
  }

  /**
   * Cancela un voucher manualmente
   */
  async cancelVoucher({ code, reason, correlation_id, user_id }) {
    const db = getDb();

    const voucher = await this.getVoucher(code, correlation_id);

    if (voucher.is_redeemed) {
      throw new ConflictError('No se puede cancelar un voucher ya canjeado');
    }

    if (voucher.status === 'cancelled') {
      throw new ValidationError('Voucher ya está cancelado');
    }

    db.prepare('UPDATE vouchers SET status = ? WHERE id = ?').run(
      'cancelled',
      voucher.id
    );

    auditLogger.info({
      event: 'voucher_cancelled',
      correlation_id,
      user_id,
      voucher_code: code,
      reason
    });

    return {
      success: true,
      message: 'Voucher cancelado exitosamente'
    };
  }
}

module.exports = { VoucherService: new VoucherService() };
