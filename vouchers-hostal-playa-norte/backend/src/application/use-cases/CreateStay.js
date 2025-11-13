/**
 * @file CreateStay Use Case
 * @description Caso de uso para crear una nueva estadía
 * @ref BLUEPRINT_ARQUITECTURA.md - Application/Use Cases Layer
 * @ref Pilar 6.1 (Business Logic Orchestration)
 */

import { z } from 'zod';
import Stay from '../../domain/entities/Stay.js';

/**
 * CreateStayDTO - Schema de entrada
 */
const CreateStayDTO = z.object({
  userId: z.string().uuid('User ID inválido'),
  hotelCode: z.string().min(2).max(10),
  roomNumber: z.string().min(1).max(10),
  checkInDate: z
    .string()
    .datetime()
    .transform((d) => new Date(d)),
  checkOutDate: z
    .string()
    .datetime()
    .transform((d) => new Date(d)),
  numberOfGuests: z.number().int().min(1).max(10),
  roomType: z.enum(['single', 'double', 'triple', 'suite']).optional(),
  basePrice: z.number().positive()
});

/**
 * CreateStay - Orquesta creación de estadía
 */
export class CreateStay {
  /**
   * @param {StayRepository} stayRepository
   * @param {UserRepository} userRepository
   * @param {Logger} logger
   */
  constructor(stayRepository, userRepository, logger) {
    this.stayRepository = stayRepository;
    this.userRepository = userRepository;
    this.logger = logger;
  }

  /**
   * Ejecutar creación de estadía
   * @param {Object} input - Datos de estadía
   * @returns {Promise<Object>} { stay, message }
   * @throws {Error} si hay validación o lógica de negocio fallida
   */
  async execute(input) {
    const validated = CreateStayDTO.parse(input);

    try {
      const user = this._findActiveUser(validated.userId);
      const nights = this._validateDates(
        validated.checkInDate,
        validated.checkOutDate
      );
      this._ensureAvailability(
        validated.roomNumber,
        validated.hotelCode,
        validated.checkInDate,
        validated.checkOutDate
      );

      const totalPrice = this._calculateTotal(nights, validated.basePrice);
      const stay = this._createStayEntity(validated, nights, totalPrice);
      const savedStay = this._persistStay(stay);

      this._logCreated(savedStay, user, validated);
      return this._formatCreateStayResponse(
        savedStay,
        nights,
        validated.checkInDate
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Datos inválidos: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Buscar usuario y validar que esté activo
   * @private
   */
  _findActiveUser(userId) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      this.logger.warn(`CreateStay: usuario no encontrado: ${userId}`);
      throw new Error(`Usuario no encontrado: ${userId}`);
    }
    if (!user.isActive) {
      this.logger.warn(`CreateStay: usuario inactivo: ${user.id}`);
      throw new Error('Cuenta de usuario desactivada');
    }
    return user;
  }

  /**
   * Validar fechas y calcular noches
   * @private
   */
  _validateDates(checkInDate, checkOutDate) {
    const nights = this.calculateNights(checkInDate, checkOutDate);
    if (nights < 1) {
      throw new Error('Duración mínima de estadía: 1 noche');
    }
    const now = new Date();
    if (checkInDate < now) {
      throw new Error('Fecha de check-in no puede ser en el pasado');
    }
    return nights;
  }

  /**
   * Verificar disponibilidad de habitación
   * @private
   */
  _ensureAvailability(roomNumber, hotelCode, checkInDate, checkOutDate) {
    const isAvailable = this.stayRepository.isRoomAvailable(
      roomNumber,
      hotelCode,
      checkInDate,
      checkOutDate
    );
    if (!isAvailable) {
      this.logger.warn(
        `CreateStay: habitación ${roomNumber} no disponible: ${checkInDate} - ${checkOutDate}`
      );
      throw new Error('Habitación no disponible para estas fechas');
    }
  }

  /**
   * Calcular total de la estadía
   * @private
   */
  _calculateTotal(nights, basePrice) {
    return nights * basePrice;
  }

  /**
   * Construir entidad Stay
   * @private
   */
  _createStayEntity(validated, nights, totalPrice) {
    return Stay.create({
      userId: validated.userId,
      hotelCode: validated.hotelCode,
      roomNumber: validated.roomNumber,
      checkInDate: validated.checkInDate,
      checkOutDate: validated.checkOutDate,
      numberOfGuests: validated.numberOfGuests,
      numberOfNights: nights,
      roomType: validated.roomType || 'double',
      basePrice: validated.basePrice,
      totalPrice,
      status: 'pending'
    });
  }

  /**
   * Persistir estadía
   * @private
   */
  _persistStay(stay) {
    return this.stayRepository.create(stay);
  }

  /**
   * Log de creación
   * @private
   */
  _logCreated(savedStay, user, validated) {
    this.logger.info(
      `Estadía creada: ${savedStay.id} para usuario ${user.email} (${validated.checkInDate} - ${validated.checkOutDate})`
    );
  }

  /**
   * Formatear respuesta
   * @private
   */
  _formatCreateStayResponse(savedStay, nights, checkInDate) {
    return {
      stay: savedStay.toJSON(),
      message: `Estadía creada exitosamente. Check-in: ${checkInDate.toLocaleDateString('es-ES')}, ${nights} noche(s).`
    };
  }

  /**
   * Calcular cantidad de noches
   * @private
   * @param {Date} checkIn
   * @param {Date} checkOut
   * @returns {number}
   */
  calculateNights(checkIn, checkOut) {
    const diffTime = Math.abs(checkOut - checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export default CreateStay;
