/**
 * @file auth.routes
 * @description Rutas de autenticación
 * @ref Pilar 7.1 (HTTP Interface)
 */

import express from 'express';

/**
 * Crear router de autenticación
 * @param {Object} services - { loginUser, registerUser, jwtService }
 * @returns {express.Router}
 */
export function createAuthRoutes(services) {
  const router = express.Router();

  const { loginUser, registerUser, jwtService } = services;

  /**
   * POST /auth/register
   * Registrar nuevo usuario
   */
  router.post('/register', async (req, res, next) => {
    try {
      const result = await registerUser.execute(req.body);

      res.status(201).json({
        success: true,
        data: result.user,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/login
   * Autenticar usuario y obtener tokens
   */
  router.post('/login', async (req, res, next) => {
    try {
      const result = await loginUser.execute(req.body);

      // Opcional: guardar refresh token en cookie segura
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/refresh
   * Refrescar access token usando refresh token
   */
  router.post('/refresh', (req, res, next) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token no proporcionado',
        });
      }

      try {
        const payload = jwtService.verifyRefreshToken(refreshToken);
        // Aquí buscarías el usuario nuevamente y generarías nuevo access token
        // Por ahora, esto es un placeholder

        res.json({
          success: true,
          data: {
            // accessToken: newAccessToken,
            // expiresIn: 7 * 24 * 60 * 60,
          },
        });
      } catch (tokenError) {
        return res.status(401).json({
          success: false,
          error: tokenError.message,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /auth/logout
   * Logout (limpiar refresh token)
   */
  router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken');
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  });

  /**
   * GET /auth/me
   * Obtener perfil del usuario autenticado
   * Requiere: Authorization: Bearer <token>
   */
  router.get('/me', authenticateToken(jwtService), (req, res) => {
    res.json({
      success: true,
      data: req.user,
    });
  });

  return router;
}

/**
 * Middleware de autenticación
 * @param {JWTService} jwtService
 * @returns {express.RequestHandler}
 */
export function authenticateToken(jwtService) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = jwtService.extractBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado',
      });
    }

    try {
      const payload = jwtService.verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
  };
}

/**
 * Middleware para verificar rol
 * @param {string|string[]} requiredRoles
 * @returns {express.RequestHandler}
 */
export function authorizeRole(requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado',
      });
    }

    next();
  };
}

/**
 * Middleware para verificar permisos
 * @param {string|string[]} requiredPermissions
 * @returns {express.RequestHandler}
 */
export function authorizePermission(requiredPermissions) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado',
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
      });
    }

    next();
  };
}

export default createAuthRoutes;
