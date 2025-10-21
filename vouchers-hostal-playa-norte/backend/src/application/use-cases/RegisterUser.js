/**
 * @file RegisterUser Use Case
 * @description Caso de uso para registro de usuario
 * @ref Pilar 6.1 (Business Logic Orchestration)
 */

import { z } from 'zod';
import User from '../../domain/entities/User.js';

/**
 * RegisterUserDTO - Schema de entrada
 */
const RegisterUserDTO = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional(),
});

/**
 * RegisterUser - Orquesta registro de usuario
 */
export class RegisterUser {
  /**
   * @param {UserRepository} userRepository
   * @param {PasswordService} passwordService
   * @param {Logger} logger
   */
  constructor(userRepository, passwordService, logger) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.logger = logger;
  }

  /**
   * Ejecutar registro
   * @param {Object} input - { email, password, confirmPassword, firstName, lastName }
   * @returns {Promise<Object>} { user, message }
   * @throws {Error} si email ya existe o datos inválidos
   */
  async execute(input) {
    // Validar entrada
    const validated = RegisterUserDTO.parse(input);

    try {
      // 1. Verificar que las contraseñas coincidan
      if (validated.password !== validated.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // 2. Validar fortaleza de contraseña
      const strength = this.passwordService.validateStrength(validated.password);
      if (strength.score < 2) {
        throw new Error(
          `Contraseña ${strength.message}. Usa mayúsculas, números y caracteres especiales.`
        );
      }

      // 3. Verificar si email ya existe
      if (this.userRepository.emailExists(validated.email)) {
        this.logger.warn(`Registro fallido: email ya existe: ${validated.email}`);
        throw new Error(`Email ya registrado: ${validated.email}`);
      }

      // 4. Hashear contraseña
      const passwordHash = await this.passwordService.hash(validated.password);

      // 5. Crear usuario
      const user = User.create({
        email: validated.email,
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone,
        passwordHash,
        role: 'guest', // Rol por defecto
        isActive: true,
      });

      // 6. Persistir en base de datos
      const savedUser = this.userRepository.create(user);

      // 7. Log de registro exitoso
      this.logger.info(`Registro exitoso para usuario: ${savedUser.email} (${savedUser.id})`);

      // 8. Retornar resultado
      return {
        user: savedUser.toJSON(),
        message: `Bienvenido ${savedUser.getFullName()}! Tu cuenta ha sido creada.`,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Datos inválidos: ${error.message}`);
      }
      throw error;
    }
  }
}

export default RegisterUser;
