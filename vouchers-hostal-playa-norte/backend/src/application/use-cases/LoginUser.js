/**
 * @file LoginUser Use Case
 * @description Caso de uso para login de usuario
 * @ref BLUEPRINT_ARQUITECTURA.md - Application/Use Cases Layer
 * @ref Pilar 6.1 (Business Logic Orchestration)
 */

import { z } from 'zod';

/**
 * LoginUserDTO - Schema de entrada
 */
const LoginUserDTO = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña inválida')
});

/**
 * LoginUser - Orquesta autenticación del usuario
 * Ref: CQRS pattern
 */
export class LoginUser {
  /**
   * @param {UserRepository} userRepository
   * @param {PasswordService} passwordService
   * @param {JWTService} jwtService
   * @param {Logger} logger
   */
  constructor(userRepository, passwordService, jwtService, logger) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.jwtService = jwtService;
    this.logger = logger;
  }

  /**
   * Ejecutar login
   * @param {Object} input - { email, password }
   * @returns {Promise<Object>} { user, accessToken, refreshToken }
   * @throws {Error} si credenciales son inválidas
   */
  async execute(input) {
    // Validar entrada
    const validated = LoginUserDTO.parse(input);

    try {
      const user = this._findActiveUserByEmail(validated.email);
      await this._verifyPassword(validated.password, user);
      const tokens = this._issueTokenPair(user);
      this._logLoginSuccess(user);
      return this._formatLoginResponse(user, tokens);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Datos inválidos: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Buscar usuario y validar que está activo
   * @private
   */
  _findActiveUserByEmail(email) {
    const user = this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.warn(`Login fallido: email no encontrado: ${email}`);
      throw new Error('Email o contraseña incorrectos');
    }
    if (!user.isActive) {
      this.logger.warn(`Login fallido: usuario inactivo: ${user.id}`);
      throw new Error('Cuenta desactivada. Contacta con soporte.');
    }
    return user;
  }

  /**
   * Verificar contraseña
   * @private
   */
  async _verifyPassword(password, user) {
    const passwordValid = await this.passwordService.verify(
      password,
      user.passwordHash
    );
    if (!passwordValid) {
      this.logger.warn(
        `Login fallido: password incorrecta para: ${user.email}`
      );
      throw new Error('Email o contraseña incorrectos');
    }
  }

  /**
   * Generar par de tokens
   * @private
   */
  _issueTokenPair(user) {
    return this.jwtService.generateTokenPair(user);
  }

  /**
   * Log de éxito
   * @private
   */
  _logLoginSuccess(user) {
    this.logger.info(`Login exitoso para usuario: ${user.email} (${user.id})`);
  }

  /**
   * Formatear respuesta de login
   * @private
   */
  _formatLoginResponse(user, tokens) {
    const { accessToken, refreshToken } = tokens;
    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiration()
    };
  }

  /**
   * Obtener expiración del token
   * @returns {number} segundos
   */
  getTokenExpiration() {
    return 7 * 24 * 60 * 60; // 7 días en segundos
  }
}

export default LoginUser;
