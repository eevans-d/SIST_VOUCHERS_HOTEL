import { jest } from '@jest/globals';
import { authenticate, authorize } from '../../../src/presentation/http/middleware/auth.middleware.js';

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

describe('auth.middleware (realcoverage)', () => {
  test('authenticate: retorna 401 si no hay token', () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'No se proporcionó token de autenticación' });
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticate: setea req.user y llama a next si hay token', () => {
    const req = { headers: { authorization: 'Bearer token-xyz' } };
    const res = createRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(req.user).toEqual({ id: 'user-123', role: 'admin' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('authorize: retorna 401 si req.user no existe', () => {
    const req = {}; // sin user
    const res = createRes();
    const next = jest.fn();

    const mw = authorize(['admin']);
    mw(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('authorize: permite acceso si role requerido coincide', () => {
    const req = { user: { id: 'user-123', role: 'admin' } };
    const res = createRes();
    const next = jest.fn();

    const mw = authorize(['admin']);
    mw(req, res, next);

    expect(res.statusCode).toBe(null); // no seteado
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('authorize: retorna 403 si role requerido no coincide', () => {
    const req = { user: { id: 'user-123', role: 'user' } };
    const res = createRes();
    const next = jest.fn();

    const mw = authorize(['admin']);
    mw(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'Acceso denegado' });
    expect(next).not.toHaveBeenCalled();
  });
});
