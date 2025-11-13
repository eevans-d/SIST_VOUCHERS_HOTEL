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
  phone: z.string().optional()
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
      this._ensurePasswordsMatch(validated.password, validated.confirmPassword);
      this._ensurePasswordStrength(validated.password);
      this._ensureEmailAvailable(validated.email);

      const passwordHash = await this._hashPassword(validated.password);
      const user = this._createUserEntity(validated, passwordHash);
      const savedUser = this._persistUser(user);
      this._logRegistered(savedUser);
      return this._formatRegisterResponse(savedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Datos inválidos: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validar coincidencia de contraseñas
   * @private
   */
  _ensurePasswordsMatch(password, confirmPassword) {
    if (password !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden');
    }
  }

  /**
   * Validar fortaleza de contraseña
   * @private
   */
  _ensurePasswordStrength(password) {
    const strength = this.passwordService.validateStrength(password);
    if (strength.score < 2) {
      throw new Error(
        `Contraseña ${strength.message}. Usa mayúsculas, números y caracteres especiales.`
      );
    }
  }

  /**
   * Verificar disponibilidad de email
   * @private
   */
  _ensureEmailAvailable(email) {
    if (this.userRepository.emailExists(email)) {
      this.logger.warn(`Registro fallido: email ya existe: ${email}`);
      throw new Error(`Email ya registrado: ${email}`);
    }
  }

  /**
   * Hashear contraseña
   * @private
   */
  async _hashPassword(password) {
    return this.passwordService.hash(password);
  }

  /**
   * Crear entidad de usuario
   * @private
   */
  _createUserEntity(validated, passwordHash) {
    return User.create({
      email: validated.email,
      firstName: validated.firstName,
      lastName: validated.lastName,
      phone: validated.phone,
      passwordHash,
      role: 'guest',
      isActive: true
    });
  }

  /**
   * Persistir usuario
   * @private
   */
  _persistUser(user) {
    return this.userRepository.create(user);
  }

  /**
   * Log de registro exitoso
   * @private
   */
  _logRegistered(savedUser) {
    this.logger.info(
      `Registro exitoso para usuario: ${savedUser.email} (${savedUser.id})`
    );
  }

  /**
   * Formatear respuesta de registro
   * @private
   */
  _formatRegisterResponse(savedUser) {
    return {
      user: savedUser.toJSON(),
      message: `Bienvenido ${savedUser.getFullName()}! Tu cuenta ha sido creada.`
    };
  }
}

export default RegisterUser;
