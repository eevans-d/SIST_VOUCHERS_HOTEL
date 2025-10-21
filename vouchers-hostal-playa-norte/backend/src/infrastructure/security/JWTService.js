/**
 * @file JWTService
 * @description Servicio de JWT para autenticación
 * @ref BLUEPRINT_ARQUITECTURA.md - Security Layer
 * @ref Pilar 4.1 (Security & Authentication)
 */

import jwt from 'jsonwebtoken';

/**
 * JWTService - Gestión de tokens JWT
 * Ref: Pilar 4.1 (JWT Authentication)
 */
export class JWTService {
  /**
   * @param {string} secret - Clave secreta JWT
   * @param {string} refreshSecret - Clave secreta para refresh tokens
   */
  constructor(secret, refreshSecret) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET debe tener mínimo 32 caracteres');
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET debe tener mínimo 32 caracteres');
    }

    this.secret = secret;
    this.refreshSecret = refreshSecret;
    this.accessTokenExpiration = '7d'; // Configurable
    this.refreshTokenExpiration = '30d'; // Configurable
  }

  /**
   * Generar access token
   * @param {User} user
   * @returns {string}
   */
  generateAccessToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.getFullName(),
      role: user.role,
      permissions: user.getPermissions(),
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.accessTokenExpiration,
      algorithm: 'HS256',
    });
  }

  /**
   * Generar refresh token
   * @param {User} user
   * @returns {string}
   */
  generateRefreshToken(user) {
    const payload = {
      sub: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshTokenExpiration,
      algorithm: 'HS256',
    });
  }

  /**
   * Generar par de tokens
   * @param {User} user
   * @returns {Object} { accessToken, refreshToken }
   */
  generateTokenPair(user) {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  /**
   * Verificar y decodificar access token
   * @param {string} token
   * @returns {Object} payload
   * @throws {Error} si token es inválido o expirado
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Access token inválido');
      }
      throw error;
    }
  }

  /**
   * Verificar y decodificar refresh token
   * @param {string} token
   * @returns {Object} payload
   * @throws {Error} si token es inválido o expirado
   */
  verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.refreshSecret, {
        algorithms: ['HS256'],
      });

      if (payload.type !== 'refresh') {
        throw new Error('Refresh token inválido');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Refresh token inválido');
      }
      throw error;
    }
  }

  /**
   * Decodificar token sin verificar
   * (SOLO para debugging)
   * @param {string} token
   * @returns {Object}
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Verificar si token está próximo a expirar (< 1 hora)
   * @param {string} token
   * @returns {boolean}
   */
  isAboutToExpire(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return false;

      const expiresIn = decoded.exp * 1000 - Date.now();
      return expiresIn < 60 * 60 * 1000; // 1 hora
    } catch {
      return true;
    }
  }

  /**
   * Obtener usuario ID del token
   * @param {string} token
   * @returns {string|null}
   */
  getUserIdFromToken(token) {
    try {
      const decoded = this.verifyAccessToken(token);
      return decoded.sub;
    } catch {
      return null;
    }
  }

  /**
   * Validar estructura de token Bearer
   * @param {string} authHeader
   * @returns {string|null} token sin "Bearer " prefix
   */
  extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  /**
   * Crear token para password reset (corta duración)
   * @param {string} userId
   * @returns {string}
   */
  generatePasswordResetToken(userId) {
    const payload = {
      sub: userId,
      type: 'password_reset',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '15m', // 15 minutos
      algorithm: 'HS256',
    });
  }

  /**
   * Verificar token de password reset
   * @param {string} token
   * @returns {Object} { userId }
   * @throws {Error}
   */
  verifyPasswordResetToken(token) {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });

      if (payload.type !== 'password_reset') {
        throw new Error('Token no es de password reset');
      }

      return { userId: payload.sub };
    } catch (error) {
      if (error.message.includes('Token no es')) throw error;

      if (error.name === 'TokenExpiredError') {
        throw new Error('Link de reset expirado');
      }

      throw new Error('Token de reset inválido');
    }
  }

  /**
   * Crear token de verificación de email (corta duración)
   * @param {string} email
   * @returns {string}
   */
  generateEmailVerificationToken(email) {
    const payload = {
      email,
      type: 'email_verification',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '24h',
      algorithm: 'HS256',
    });
  }

  /**
   * Verificar token de verificación de email
   * @param {string} token
   * @returns {Object} { email }
   * @throws {Error}
   */
  verifyEmailVerificationToken(token) {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });

      if (payload.type !== 'email_verification') {
        throw new Error('Token no es de verificación de email');
      }

      return { email: payload.email };
    } catch (error) {
      if (error.message.includes('Token no es')) throw error;

      if (error.name === 'TokenExpiredError') {
        throw new Error('Link de verificación expirado');
      }

      throw new Error('Token de verificación inválido');
    }
  }
}

export default JWTService;
