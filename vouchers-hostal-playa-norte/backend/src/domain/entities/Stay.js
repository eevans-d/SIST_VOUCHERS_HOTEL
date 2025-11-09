/**
 * @file Stay Entity
 * @description Entidad de dominio para Estadía de Huésped
 * @ref CONSTITUCION_SISTEMA_VOUCHERS.md - Pilar 3.1 (Domain Entities)
 * @ref BLUEPRINT_ARQUITECTURA.md - Domain Layer
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schema Zod para validación de Stay
 * Ref: Pilar 2.1 (Standards & Validation)
 */
const StaySchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .default(() => uuidv4()),
  userId: z.string().uuid('User ID inválido'),
  hotelCode: z.string().min(2, 'Código de hotel inválido').max(10),
  roomNumber: z.string().min(1, 'Número de habitación inválido').max(10),
  checkInDate: z.date('Fecha check-in inválida'),
  checkOutDate: z.date('Fecha check-out inválida'),
  numberOfGuests: z.number().int().min(1, 'Mínimo 1 huésped').max(10),
  numberOfNights: z.number().int().positive('Noches debe ser positivo'),
  roomType: z.enum(['single', 'double', 'triple', 'suite']).default('double'),
  basePrice: z.number().positive('Precio base debe ser positivo'),
  totalPrice: z.number().positive('Precio total debe ser positivo'),
  status: z
    .enum(['pending', 'active', 'completed', 'cancelled'])
    .default('pending'),
  notes: z.string().max(500).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

/**
 * Stay Entity
 * Encapsula lógica de dominio de estadía
 * Ref: Pilar 3.1 (Domain Logic)
 */
export class Stay {
  constructor(data) {
    // Validar que checkOut > checkIn
    if (data.checkOutDate <= data.checkInDate) {
      throw new Error('Fecha de check-out debe ser posterior a check-in');
    }

    const validated = StaySchema.parse(data);
    Object.assign(this, validated);
  }

  /**
   * Crear nueva estadía desde datos raw
   * @param {Object} data
   * @returns {Stay}
   */
  static create(data) {
    return new Stay(data);
  }

  /**
   * Calcular cantidad de noches
   * @returns {number}
   */
  calculateNights() {
    const diffTime = Math.abs(this.checkOutDate - this.checkInDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calcular precio total basado en noches
   * @param {number} nightly - Precio por noche
   * @returns {number}
   */
  calculateTotalPrice(nightly) {
    const nights = this.calculateNights();
    return nights * nightly;
  }

  /**
   * Verificar si estadía está activa
   * @returns {boolean}
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Verificar si estadía está completada
   * @returns {boolean}
   */
  isCompleted() {
    return this.status === 'completed';
  }

  /**
   * Verificar si estadía está cancelada
   * @returns {boolean}
   */
  isCancelled() {
    return this.status === 'cancelled';
  }

  /**
   * Obtener cantidad de días restantes
   * @returns {number}
   */
  getDaysRemaining() {
    const now = new Date();
    if (now >= this.checkOutDate) return 0;
    if (now < this.checkInDate) return this.calculateNights();

    const diffTime = Math.abs(this.checkOutDate - now);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verificar si es hoy el check-in
   * @returns {boolean}
   */
  isCheckInToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(this.checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    return today.getTime() === checkIn.getTime();
  }

  /**
   * Verificar si es hoy el check-out
   * @returns {boolean}
   */
  isCheckOutToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOut = new Date(this.checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    return today.getTime() === checkOut.getTime();
  }

  /**
   * Activar estadía
   */
  activate() {
    if (this.status !== 'pending') {
      throw new Error('Solo estadías pendientes pueden activarse');
    }
    this.status = 'active';
    this.updatedAt = new Date();
  }

  /**
   * Completar estadía
   */
  complete() {
    if (!this.isActive()) {
      throw new Error('Solo estadías activas pueden completarse');
    }
    this.status = 'completed';
    this.updatedAt = new Date();
  }

  /**
   * Cancelar estadía
   * @param {string} reason - Razón de cancelación
   */
  cancel(reason) {
    if (this.isCompleted()) {
      throw new Error('No se pueden cancelar estadías completadas');
    }
    this.status = 'cancelled';
    if (reason) this.notes = `CANCELADA: ${reason}`;
    this.updatedAt = new Date();
  }

  /**
   * Actualizar notas de estadía
   * @param {string} newNotes
   */
  updateNotes(newNotes) {
    if (newNotes && newNotes.length > 500) {
      throw new Error('Notas no pueden exceder 500 caracteres');
    }
    this.notes = newNotes;
    this.updatedAt = new Date();
  }

  /**
   * Serializar para JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      hotelCode: this.hotelCode,
      roomNumber: this.roomNumber,
      checkInDate: this.checkInDate.toISOString(),
      checkOutDate: this.checkOutDate.toISOString(),
      numberOfGuests: this.numberOfGuests,
      numberOfNights: this.numberOfNights,
      roomType: this.roomType,
      basePrice: this.basePrice,
      totalPrice: this.totalPrice,
      status: this.status,
      notes: this.notes,
      daysRemaining: this.getDaysRemaining(),
      isCheckInToday: this.isCheckInToday(),
      isCheckOutToday: this.isCheckOutToday(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Obtener datos para persistencia
   * @returns {Object}
   */
  toPersistence() {
    return {
      id: this.id,
      userId: this.userId,
      hotelCode: this.hotelCode,
      roomNumber: this.roomNumber,
      checkInDate: this.checkInDate.toISOString(),
      checkOutDate: this.checkOutDate.toISOString(),
      numberOfGuests: this.numberOfGuests,
      numberOfNights: this.numberOfNights,
      roomType: this.roomType,
      basePrice: this.basePrice,
      totalPrice: this.totalPrice,
      status: this.status,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Recrear desde datos de persistencia
   * @param {Object} data
   * @returns {Stay}
   */
  static fromPersistence(data) {
    return new Stay({
      ...data,
      checkInDate: new Date(data.checkInDate),
      checkOutDate: new Date(data.checkOutDate),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      notes: data.notes ?? undefined
    });
  }
}

export default Stay;
