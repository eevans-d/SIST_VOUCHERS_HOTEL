const { z } = require('zod');

/**
 * Schema de validación para Voucher
 * @type {z.ZodSchema}
 */
const VoucherSchema = z.object({
  id: z.string().uuid().optional(),
  stayId: z.string().uuid(),
  code: z.string().min(6).max(20).regex(/^[A-Z0-9-]+$/),
  qrCode: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'redeemed', 'expired', 'cancelled']).default('pending'),
  redemptionDate: z.date().optional().nullable(),
  redemptionNotes: z.string().max(500).optional().nullable(),
  expiryDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Entidad Voucher - Representa un comprobante para canje en cafetería
 * 
 * Estados:
 * - pending: Generado pero no activado (espera que el stay se active)
 * - active: Disponible para canjear
 * - redeemed: Ya fue canjeado
 * - expired: Pasó la fecha de expiración
 * - cancelled: Anulado (junto con el stay)
 * 
 * @class Voucher
 * @example
 * const voucher = Voucher.create({
 *   stayId: '123e4567-e89b-12d3-a456-426614174000',
 *   code: 'VOC-ABC-1234',
 *   expiryDate: new Date('2025-12-31')
 * });
 */
class Voucher {
  /**
   * @param {Object} data - Datos del voucher
   * @param {string} data.id - UUID único
   * @param {string} data.stayId - ID de la estadía asociada
   * @param {string} data.code - Código único del voucher (ej: VOC-ABC-1234)
   * @param {string} [data.qrCode] - Código QR codificado en base64/URL
   * @param {'pending'|'active'|'redeemed'|'expired'|'cancelled'} data.status - Estado actual
   * @param {Date} [data.redemptionDate] - Fecha/hora del canje
   * @param {string} [data.redemptionNotes] - Notas sobre el canje
   * @param {Date} [data.expiryDate] - Fecha de expiración
   * @param {Date} data.createdAt - Fecha de creación
   * @param {Date} data.updatedAt - Fecha de última actualización
   * @throws {Error} Si la validación falla
   */
  constructor(data) {
    const validated = VoucherSchema.parse(data);
    Object.assign(this, validated);
  }

  /**
   * Factory method para crear nuevo voucher
   * 
   * @static
   * @param {Object} params - Parámetros para crear voucher
   * @param {string} params.stayId - ID de la estadía
   * @param {string} [params.code] - Código (auto-generado si no se proporciona)
   * @param {Date} [params.expiryDate] - Fecha de expiración (por defecto: 30 días)
   * @returns {Voucher} Nueva instancia de Voucher
   * @example
   * const voucher = Voucher.create({
   *   stayId: stayId,
   *   expiryDate: new Date(Date.now() + 30*24*60*60*1000)
   * });
   */
  static create({
    stayId,
    code,
    expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }) {
    const generatedCode = code || Voucher.generateCode();

    return new Voucher({
      stayId,
      code: generatedCode,
      status: 'pending',
      expiryDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Genera un código único de voucher
   * Formato: VOC-XXXXXX-YYYY (12 caracteres alfanuméricos)
   * 
   * @static
   * @returns {string} Código único
   */
  static generateCode() {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `VOC-${random}-${timestamp}`;
  }

  /**
   * Activa el voucher (pasa a estado 'active')
   * Se llama cuando la estadía se activa
   * 
   * @returns {Voucher} this para encadenamiento
   * @throws {Error} Si el status no es 'pending'
   */
  activate() {
    if (this.status !== 'pending') {
      throw new Error(
        `No se puede activar voucher en estado '${this.status}'. Solo 'pending' puede activarse.`
      );
    }

    this.status = 'active';
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Cambia estado a 'redeemed' (canjeado)
   * 
   * @param {string} [notes] - Notas opcionales sobre el canje
   * @returns {Voucher} this para encadenamiento
   * @throws {Error} Si el status no es 'active'
   * @throws {Error} Si la fecha de hoy está fuera de validez
   */
  redeem(notes = null) {
    if (this.status !== 'active') {
      throw new Error(
        `No se puede canjear voucher en estado '${this.status}'. Solo 'active' puede canjearse.`
      );
    }

    if (new Date() > this.expiryDate) {
      throw new Error(`Voucher expirado. Fecha límite: ${this.expiryDate.toISOString()}`);
    }

    this.status = 'redeemed';
    this.redemptionDate = new Date();
    this.redemptionNotes = notes;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Marca el voucher como expirado (cuando se pasa la fecha de vencimiento)
   * Típicamente llamado por un job de limpieza
   * 
   * @returns {Voucher} this para encadenamiento
   * @throws {Error} Si el status no es 'active'
   */
  expire() {
    if (this.status !== 'active') {
      throw new Error(
        `No se puede expirar voucher en estado '${this.status}'. Solo 'active' puede expirar.`
      );
    }

    this.status = 'expired';
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Cancela el voucher (se cancela junto con la estadía)
   * 
   * @returns {Voucher} this para encadenamiento
   * @throws {Error} Si el voucher ya fue canjeado
   */
  cancel() {
    if (this.status === 'redeemed') {
      throw new Error('No se puede cancelar un voucher ya canjeado');
    }

    this.status = 'cancelled';
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Valida si el voucher es válido (activo y no expirado)
   * 
   * @returns {boolean} true si es válido
   */
  isValid() {
    return this.status === 'active' && new Date() <= this.expiryDate;
  }

  /**
   * Verifica si el voucher puede ser canjeado
   * 
   * @returns {boolean} true si puede canjearse
   */
  canRedeem() {
    return this.isValid();
  }

  /**
   * Calcula días restantes hasta expiración
   * 
   * @returns {number} Días restantes (puede ser negativo si está expirado)
   */
  getDaysRemaining() {
    const now = new Date();
    const diffMs = this.expiryDate - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si el voucher está expirado
   * 
   * @returns {boolean} true si está expirado
   */
  isExpired() {
    return new Date() > this.expiryDate;
  }

  /**
   * Serializa el voucher a formato JSON
   * Excluye datos sensibles si es necesario
   * 
   * @param {boolean} [includeQR=true] - Si incluir código QR
   * @returns {Object} Objeto serializado
   */
  toJSON(includeQR = true) {
    return {
      id: this.id,
      stayId: this.stayId,
      code: this.code,
      qrCode: includeQR ? this.qrCode : undefined,
      status: this.status,
      redemptionDate: this.redemptionDate?.toISOString(),
      redemptionNotes: this.redemptionNotes,
      expiryDate: this.expiryDate?.toISOString(),
      daysRemaining: this.getDaysRemaining(),
      isExpired: this.isExpired(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Valida que el schema coincida con la definición
   * 
   * @static
   * @returns {z.ZodSchema} Schema de validación
   */
  static getSchema() {
    return VoucherSchema;
  }
}

module.exports = Voucher;
