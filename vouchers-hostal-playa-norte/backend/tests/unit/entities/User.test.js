/**
 * @file User.test.js
 * @description Tests unitarios para User Entity
 * @ref BLUEPRINT_ARQUITECTURA.md - Testing Layer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import User from '../../../src/domain/entities/User';

describe('User Entity', () => {
  let userData;

  beforeEach(() => {
    userData = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+34 666 123 456',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: 'guest',
      isActive: true,
    };
  });

  describe('create', () => {
    it('debe crear un usuario válido', () => {
      const user = User.create(userData);
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.id).toBeDefined();
    });

    it('debe generar UUID automáticamente', () => {
      const user = User.create(userData);
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('debe lanzar error si email es inválido', () => {
      expect(() => {
        User.create({ ...userData, email: 'invalid-email' });
      }).toThrow();
    });

    it('debe lanzar error si firstName es muy corto', () => {
      expect(() => {
        User.create({ ...userData, firstName: 'J' });
      }).toThrow();
    });
  });

  describe('getFullName', () => {
    it('debe retornar nombre completo', () => {
      const user = User.create(userData);
      expect(user.getFullName()).toBe('John Doe');
    });
  });

  describe('isAdmin', () => {
    it('debe retornar true si rol es admin', () => {
      const user = User.create({ ...userData, role: 'admin' });
      expect(user.isAdmin()).toBe(true);
    });

    it('debe retornar false si rol no es admin', () => {
      const user = User.create({ ...userData, role: 'guest' });
      expect(user.isAdmin()).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('admin debe tener todos los permisos', () => {
      const user = User.create({ ...userData, role: 'admin' });
      const permissions = user.getPermissions();
      expect(permissions).toContain('manage:users');
      expect(permissions).toContain('manage:system');
    });

    it('guest debe tener permisos limitados', () => {
      const user = User.create({ ...userData, role: 'guest' });
      const permissions = user.getPermissions();
      expect(permissions).toContain('read:own_profile');
      expect(permissions).toContain('redeem:vouchers');
      expect(permissions).not.toContain('manage:users');
    });
  });

  describe('toJSON', () => {
    it('no debe incluir passwordHash en JSON', () => {
      const user = User.create(userData);
      const json = user.toJSON();
      expect(json.passwordHash).toBeUndefined();
      expect(json.email).toBeDefined();
    });
  });

  describe('changeRole', () => {
    it('debe cambiar rol del usuario', () => {
      const user = User.create(userData);
      user.changeRole('staff');
      expect(user.role).toBe('staff');
    });

    it('debe lanzar error si rol es inválido', () => {
      const user = User.create(userData);
      expect(() => {
        user.changeRole('invalid_role');
      }).toThrow();
    });
  });

  describe('activate/deactivate', () => {
    it('debe activar usuario', () => {
      const user = User.create({ ...userData, isActive: false });
      user.activate();
      expect(user.isActive).toBe(true);
    });

    it('debe desactivar usuario', () => {
      const user = User.create(userData);
      user.deactivate();
      expect(user.isActive).toBe(false);
    });
  });
});
