/**
 * @file Voucher Entity
 * @description Entidad de dominio para Voucher
 * @ref BLUEPRINT_ARQUITECTURA.md - Domain Layer
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const VoucherSchema = z.object({
  id: z.string().uuid().optional().default(() => uuidv4()),
  code: z.string().min(1, "Code is required"),
  stayId: z.string().uuid("Invalid Stay ID"),
  validFrom: z.date("Invalid validFrom date"),
  validUntil: z.date("Invalid validUntil date"),
  hmacSignature: z.string().min(1, "HMAC signature is required"),
  status: z.enum(['active', 'redeemed', 'expired', 'cancelled']).default('active'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export class Voucher {
  constructor(data) {
    if (data.validUntil <= data.validFrom) {
      throw new Error('validUntil must be after validFrom');
    }
    const validated = VoucherSchema.parse(data);
    Object.assign(this, validated);
  }

  static create(data) {
    return new Voucher(data);
  }

  isRedeemed() {
    return this.status === 'redeemed';
  }

  isExpired() {
    const now = new Date();
    return now > this.validUntil;
  }

  isActive() {
    return this.status === 'active' && !this.isExpired();
  }

  redeem() {
    if (this.status !== 'active') {
      throw new Error('Only active vouchers can be redeemed');
    }
    if (this.isExpired()) {
      throw new Error('Cannot redeem an expired voucher');
    }
    this.status = 'redeemed';
    this.updatedAt = new Date();
  }

  cancel() {
    if (this.status === 'redeemed') {
      throw new Error('Cannot cancel a redeemed voucher');
    }
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      stayId: this.stayId,
      validFrom: this.validFrom.toISOString(),
      validUntil: this.validUntil.toISOString(),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toPersistence() {
    return {
      id: this.id,
      code: this.code,
      stayId: this.stayId,
      validFrom: this.validFrom.toISOString(),
      validUntil: this.validUntil.toISOString(),
      hmacSignature: this.hmacSignature,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromPersistence(data) {
    return new Voucher({
      ...data,
      validFrom: new Date(data.validFrom),
      validUntil: new Date(data.validUntil),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }
}

export default Voucher;