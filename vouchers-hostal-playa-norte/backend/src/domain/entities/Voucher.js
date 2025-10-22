import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Esquema de validación para Voucher
export const VoucherSchema = z.object({
  id: z.string().uuid().optional(),
  stayId: z.string().uuid(),
  code: z.string().min(5).max(20),
  qrCode: z.string().url().optional(),
  status: z.enum(['pending', 'active', 'redeemed', 'expired', 'cancelled']),
  redemptionDate: z.date().nullable().optional(),
  expiryDate: z.date(),
  redemptionNotes: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Entidad Voucher - Comprobantes digitales para consumo en cafetería
 * State Machine: pending → active → redeemed/expired/cancelled
 */
export class Voucher {
  constructor(props) {
    this.id = props.id || uuidv4();
    this.stayId = props.stayId;
    this.code = props.code;
    this.qrCode = props.qrCode;
    this.status = props.status || 'pending';
    this.redemptionDate = props.redemptionDate || null;
    this.expiryDate = props.expiryDate;
    this.redemptionNotes = props.redemptionNotes || '';
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  /**
   * Factory method: Crear nuevo voucher
   */
  static create({ stayId, code, qrCode, expiryDate }) {
    const props = {
      id: uuidv4(),
      stayId,
      code,
      qrCode,
      expiryDate,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    VoucherSchema.parse(props);
    return new Voucher(props);
  }

  /**
   * Activar voucher (pending → active)
   */
  activate() {
    if (this.status !== 'pending') {
      throw new Error(`No se puede activar voucher con estado: ${this.status}`);
    }
    this.status = 'active';
    this.updatedAt = new Date();
  }

  /**
   * Canjear voucher (active → redeemed)
   */
  redeem(notes = '') {
    if (this.status !== 'active') {
      throw new Error(`No se puede canjear voucher con estado: ${this.status}`);
    }
    if (this.isExpired()) {
      throw new Error('Voucher expirado');
    }
    this.status = 'redeemed';
    this.redemptionDate = new Date();
    this.redemptionNotes = notes;
    this.updatedAt = new Date();
  }

  /**
   * Expirar voucher (active → expired)
   */
  expire() {
    if (this.status !== 'active') {
      throw new Error(`No se puede expirar voucher con estado: ${this.status}`);
    }
    this.status = 'expired';
    this.updatedAt = new Date();
  }

  /**
   * Cancelar voucher
   */
  cancel(reason = '') {
    if (!['pending', 'active'].includes(this.status)) {
      throw new Error(`No se puede cancelar voucher con estado: ${this.status}`);
    }
    this.status = 'cancelled';
    this.redemptionNotes = reason;
    this.updatedAt = new Date();
  }

  /**
   * Verificar si voucher está expirado
   */
  isExpired() {
    return new Date() > new Date(this.expiryDate);
  }

  /**
   * Verificar si voucher es válido para canjear
   */
  isValid() {
    return this.status === 'active' && !this.isExpired();
  }

  /**
   * Días restantes hasta expiración
   */
  getDaysRemaining() {
    const now = new Date();
    const diffTime = Math.abs(this.expiryDate - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Serializar para BD
   */
  toJSON() {
    return {
      id: this.id,
      stayId: this.stayId,
      code: this.code,
      qrCode: this.qrCode,
      status: this.status,
      redemptionDate: this.redemptionDate,
      expiryDate: this.expiryDate,
      redemptionNotes: this.redemptionNotes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Crear desde BD
   */
  static fromDatabase(data) {
    return new Voucher({
      ...data,
      expiryDate: new Date(data.expiryDate),
      redemptionDate: data.redemptionDate ? new Date(data.redemptionDate) : null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }
}
