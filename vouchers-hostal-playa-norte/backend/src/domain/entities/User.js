/**
 * @file User Entity
 * @description Entidad de dominio para Usuario
 * @ref CONSTITUCION_SISTEMA_VOUCHERS.md - Pilar 3.1 (Domain Entities)
 * @ref BLUEPRINT_ARQUITECTURA.md - Domain Layer
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schema Zod para validación de Usuario
 * Ref: Pilar 2.1 (Standards & Validation)
 */
const UserSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .default(() => uuidv4()),
  email: z.string().email('Email inválido').toLowerCase(),
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]*$/, 'Teléfono inválido')
    .nullable()
    .optional(),
  role: z.enum(['admin', 'staff', 'guest', 'cafe_manager']).default('guest'),
  passwordHash: z.string().min(60, 'Password hash inválido'),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

/**
 * User Entity
 * Encapsula lógica de dominio del usuario
 * Ref: Pilar 3.1 (Domain Logic)
 */
export class User {
  constructor(data) {
    // Validar contra schema
    const validated = UserSchema.parse(data);

    Object.assign(this, validated);
  }

  /**
   * Crear nuevo usuario desde datos raw
   * @param {Object} data - Datos del usuario
   * @returns {User}
   */
  static create(data) {
    return new User(data);
  }

  /**
   * Obtener nombre completo
   * @returns {string}
   */
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Verificar si usuario es administrador
   * @returns {boolean}
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Verificar si usuario es staff
   * @returns {boolean}
   */
  isStaff() {
    return this.role === 'staff' || this.isAdmin();
  }

  /**
   * Verificar si usuario es manager de cafetería
   * @returns {boolean}
   */
  isCafeManager() {
    return this.role === 'cafe_manager' || this.isAdmin();
  }

  /**
   * Obtener permisos basados en rol
   * Ref: Pilar 4.1 (RBAC)
   * @returns {string[]}
   */
  getPermissions() {
    const basePermissions = ['read:own_profile'];

    switch (this.role) {
    case 'admin':
      return [
        ...basePermissions,
        'manage:users',
        'manage:stays',
        'manage:vouchers',
        'manage:cafe_orders',
        'view:analytics',
        'view:reports',
        'manage:system'
      ];
    case 'staff':
      return [
        ...basePermissions,
        'manage:stays',
        'manage:vouchers',
        'view:analytics'
      ];
    case 'cafe_manager':
      return [
        ...basePermissions,
        'manage:cafe_orders',
        'view:cafe_analytics'
      ];
    case 'guest':
    default:
      return [
        ...basePermissions,
        'read:stays',
        'read:vouchers',
        'redeem:vouchers'
      ];
    }
  }

  /**
   * Marcar usuario como activo
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Desactivar usuario
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Cambiar rol del usuario
   * @param {string} newRole - Nuevo rol
   */
  changeRole(newRole) {
    if (!['admin', 'staff', 'guest', 'cafe_manager'].includes(newRole)) {
      throw new Error(`Rol inválido: ${newRole}`);
    }
    this.role = newRole;
    this.updatedAt = new Date();
  }

  /**
   * Serializar para JSON (sin datos sensibles)
   * @returns {Object}
   */
  toJSON() {
    const { passwordHash, ...safe } = this;
    return safe;
  }

  /**
   * Obtener datos para persistencia
   * @returns {Object}
   */
  toPersistence() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || null,
      role: this.role,
      passwordHash: this.passwordHash,
      isActive: this.isActive ? 1 : 0,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Recrear desde datos de persistencia
   * @param {Object} data
   * @returns {User}
   */
  static fromPersistence(data) {
    return new User({
      ...data,
        // Normalizar nulls
        phone: data.phone ?? undefined,
      isActive: Boolean(data.isActive),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    });
  }
}

export default User;
