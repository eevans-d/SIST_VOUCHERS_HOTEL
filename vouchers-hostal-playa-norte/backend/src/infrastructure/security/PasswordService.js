/**
 * @file PasswordService
 * @description Servicio de hashing y verificación de contraseñas
 * @ref Pilar 4.1 (Security - Password Management)
 */

import bcrypt from 'bcryptjs';

/**
 * PasswordService - Gestión segura de contraseñas
 */
export class PasswordService {
  /**
   * @param {number} rounds - Rounds de bcrypt (default 10)
   */
  constructor(rounds = 10) {
    if (rounds < 8 || rounds > 15) {
      throw new Error('Bcrypt rounds debe estar entre 8 y 15');
    }
    this.rounds = rounds;
  }

  /**
   * Hashear contraseña
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<string>} hash
   */
  async hash(password) {
    if (!password || password.length < 8) {
      throw new Error('Contraseña debe tener mínimo 8 caracteres');
    }

    return bcrypt.hash(password, this.rounds);
  }

  /**
   * Verificar contraseña
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash para comparar
   * @returns {Promise<boolean>}
   */
  async verify(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generar contraseña temporal aleatoria
   * @param {number} length - Longitud (default 12)
   * @returns {string}
   */
  generateTempPassword(length = 12) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Validar fortaleza de contraseña
   * @param {string} password
   * @returns {Object} { score, message }
   */
  validateStrength(password) {
    if (!password || password.length < 8) {
      return { score: 0, message: 'Muy débil (< 8 caracteres)' };
    }

    let score = 1;

    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;

    const messages = {
      1: 'Débil',
      2: 'Regular',
      3: 'Buena',
      4: 'Fuerte',
      5: 'Muy fuerte'
    };

    return {
      score,
      message: messages[score] || 'Desconocida'
    };
  }
}

export default PasswordService;
