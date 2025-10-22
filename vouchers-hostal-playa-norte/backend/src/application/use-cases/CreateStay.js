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
  checkInDate: z.string().datetime().transform(d => new Date(d)),
  checkOutDate: z.string().datetime().transform(d => new Date(d)),
  numberOfGuests: z.number().int().min(1).max(10),
  roomType: z.enum(['single', 'double', 'triple', 'suite']).optional(),
  basePrice: z.number().positive(),
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
      // 1. Verificar que usuario existe
      const user = this.userRepository.findById(validated.userId);
      if (!user) {
        this.logger.warn(`CreateStay: usuario no encontrado: ${validated.userId}`);
        throw new Error(`Usuario no encontrado: ${validated.userId}`);
      }

      // 2. Verificar que usuario está activo
      if (!user.isActive) {
        this.logger.warn(`CreateStay: usuario inactivo: ${user.id}`);
        throw new Error('Cuenta de usuario desactivada');
      }

      // 3. Calcular cantidad de noches
      const nights = this.calculateNights(validated.checkInDate, validated.checkOutDate);
      if (nights < 1) {
        throw new Error('Duración mínima de estadía: 1 noche');
      }

      // 4. Validar que check-in no sea en el pasado
      const now = new Date();
      if (validated.checkInDate < now) {
        throw new Error('Fecha de check-in no puede ser en el pasado');
      }

      // 5. Verificar disponibilidad de habitación
      const isAvailable = this.stayRepository.isRoomAvailable(
        validated.roomNumber,
        validated.hotelCode,
        validated.checkInDate,
        validated.checkOutDate
      );

      if (!isAvailable) {
        this.logger.warn(
          `CreateStay: habitación ${validated.roomNumber} no disponible: ${validated.checkInDate} - ${validated.checkOutDate}`
        );
        throw new Error('Habitación no disponible para estas fechas');
      }

      // 6. Calcular precio total
      const totalPrice = nights * validated.basePrice;

      // 7. Crear entidad Stay
      const stay = Stay.create({
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
        status: 'pending',
      });

      // 8. Persistir en base de datos
      const savedStay = this.stayRepository.create(stay);

      // 9. Log
      this.logger.info(
        `Estadía creada: ${savedStay.id} para usuario ${user.email} (${validated.checkInDate} - ${validated.checkOutDate})`
      );

      // 10. Retornar resultado
      return {
        stay: savedStay.toJSON(),
        message: `Estadía creada exitosamente. Check-in: ${validated.checkInDate.toLocaleDateString('es-ES')}, ${nights} noche(s).`,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Datos inválidos: ${error.message}`);
      }
      throw error;
    }
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
