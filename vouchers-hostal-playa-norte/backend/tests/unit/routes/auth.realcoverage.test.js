import { jest } from '@jest/globals';

import {
  authenticateToken,
  authorizeRole,
  authorizePermission
} from '../../../src/presentation/http/routes/auth.js';

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('auth.routes helpers (realcoverage)', () => {
  describe('authenticateToken', () => {
    test('401 cuando no hay token', () => {
      const jwtService = {
        extractBearerToken: jest.fn(() => null)
      };
      const req = { headers: {} };
      const res = createRes();
      const next = jest.fn();

      const mw = authenticateToken(jwtService);
      mw(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'Token no proporcionado' });
      expect(next).not.toHaveBeenCalled();
    });

    test('403 cuando verifyAccessToken lanza error', () => {
      const jwtService = {
        extractBearerToken: jest.fn(() => 'badtoken'),
        verifyAccessToken: jest.fn(() => { throw new Error('invalid token'); })
      };
      const req = { headers: { authorization: 'Bearer badtoken' } };
      const res = createRes();
      const next = jest.fn();

      const mw = authenticateToken(jwtService);
      mw(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ success: false, error: 'invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('next() cuando token es válido', () => {
      const userPayload = { sub: 'u-1', role: 'admin' };
      const jwtService = {
        extractBearerToken: jest.fn(() => 'goodtoken'),
        verifyAccessToken: jest.fn(() => userPayload)
      };
      const req = { headers: { authorization: 'Bearer goodtoken' } };
      const res = createRes();
      const next = jest.fn();

      const mw = authenticateToken(jwtService);
      mw(req, res, next);

      expect(req.user).toEqual(userPayload);
      expect(res.statusCode).toBe(null);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('authorizeRole', () => {
    test('401 si no hay user', () => {
      const mw = authorizeRole(['admin']);
      const req = {}; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'No autenticado' });
      expect(next).not.toHaveBeenCalled();
    });

    test('403 si rol no permitido', () => {
      const mw = authorizeRole(['admin']);
      const req = { user: { role: 'guest' } }; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ success: false, error: 'Acceso denegado' });
    });

    test('permite acceso si rol permitido', () => {
      const mw = authorizeRole(['admin', 'staff']);
      const req = { user: { role: 'admin' } }; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('authorizePermission', () => {
    test('401 si no hay user', () => {
      const mw = authorizePermission(['manage:users']);
      const req = {}; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'No autenticado' });
    });

    test('403 si no tiene permisos requeridos', () => {
      const mw = authorizePermission(['manage:users']);
      const req = { user: { permissions: ['read:own_profile'] } }; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ success: false, error: 'Permisos insuficientes' });
    });

    test('permite acceso si tiene algún permiso', () => {
      const mw = authorizePermission(['manage:users', 'view:reports']);
      const req = { user: { permissions: ['view:reports'] } }; const res = createRes(); const next = jest.fn();
      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
