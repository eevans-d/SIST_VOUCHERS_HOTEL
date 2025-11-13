/**
 * @file UserRepository
 * @description Repositorio de Usuario con persistencia SQLite
 * @ref BLUEPRINT_ARQUITECTURA.md - Persistence Layer
 * @ref Pilar 8.1 (Data Management)
 */

import User from '../entities/User.js';

/**
 * UserRepository - Abstracción de persistencia de usuarios
 * Ref: Pilar 5.1 (Repository Pattern)
 */
export class UserRepository {
  /**
   * @param {Database.Database} db - Instancia de SQLite
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Crear nuevo usuario
   * Ref: Pilar 9.1 (Data Integrity - UNIQUE constraint)
   * @param {User} user
   * @returns {User}
   * @throws {Error} si email ya existe
   */
  create(user) {
    try {
      const data = user.toPersistence();
      const stmt = this.db.prepare(`
        INSERT INTO users (
          id, email, firstName, lastName, phone, role, 
          passwordHash, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.id,
        data.email,
        data.firstName,
        data.lastName,
        data.phone,
        data.role,
        data.passwordHash,
        data.isActive,
        data.createdAt,
        data.updatedAt
      );

      return user;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Email ya registrado: ${user.email}`);
      }
      throw error;
    }
  }

  /**
   * Obtener usuario por ID
   * @param {string} id - UUID del usuario
   * @returns {User|null}
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id);
    return row ? User.fromPersistence(row) : null;
  }

  /**
   * Obtener usuario por email
   * @param {string} email
   * @returns {User|null}
   */
  findByEmail(email) {
    const stmt = this.db.prepare(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
    );
    const row = stmt.get(email);
    return row ? User.fromPersistence(row) : null;
  }

  /**
   * Obtener todos los usuarios
   * @param {Object} options - { limit, offset, role, isActive }
   * @returns {User[]}
   */
  findAll(options = {}) {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (options.role) {
      query += ' AND role = ?';
      params.push(options.role);
    }

    if (options.isActive !== undefined) {
      query += ' AND isActive = ?';
      params.push(options.isActive ? 1 : 0);
    }

    query += ' ORDER BY createdAt DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map((row) => User.fromPersistence(row));
  }

  /**
   * Obtener conteo total de usuarios
   * @param {Object} filters - { role, isActive }
   * @returns {number}
   */
  count(filters = {}) {
    let query = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.isActive !== undefined) {
      query += ' AND isActive = ?';
      params.push(filters.isActive ? 1 : 0);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);
    return result.total;
  }

  /**
   * Actualizar usuario
   * @param {string} id
   * @param {Partial<User>} updates
   * @returns {User}
   */
  update(id, updates) {
    const user = this.findById(id);
    if (!user) {
      throw new Error(`Usuario no encontrado: ${id}`);
    }

    // Aplicar actualizaciones
    Object.assign(user, updates);
    user.updatedAt = new Date();

    const data = user.toPersistence();
    const stmt = this.db.prepare(`
      UPDATE users SET
        email = ?, firstName = ?, lastName = ?, phone = ?,
        role = ?, passwordHash = ?, isActive = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(
      data.email,
      data.firstName,
      data.lastName,
      data.phone,
      data.role,
      data.passwordHash,
      data.isActive,
      data.updatedAt,
      id
    );

    return user;
  }

  /**
   * Eliminar usuario (soft delete)
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const stmt = this.db.prepare('UPDATE users SET isActive = 0 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Activar usuario
   * @param {string} id
   * @returns {User}
   */
  activate(id) {
    const user = this.findById(id);
    if (!user) {
      throw new Error(`Usuario no encontrado: ${id}`);
    }
    user.activate();
    return this.update(id, { isActive: true });
  }

  /**
   * Desactivar usuario
   * @param {string} id
   * @returns {User}
   */
  deactivate(id) {
    const user = this.findById(id);
    if (!user) {
      throw new Error(`Usuario no encontrado: ${id}`);
    }
    user.deactivate();
    return this.update(id, { isActive: false });
  }

  /**
   * Obtener usuarios por rol
   * @param {string} role - admin|staff|guest|cafe_manager
   * @returns {User[]}
   */
  findByRole(role) {
    return this.findAll({ role, isActive: true });
  }

  /**
   * Verificar si email existe
   * @param {string} email
   * @returns {boolean}
   */
  emailExists(email) {
    const stmt = this.db.prepare(
      'SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'
    );
    return stmt.get(email) !== undefined;
  }

  /**
   * Obtener estadísticas de usuarios
   * @returns {Object}
   */
  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff,
        SUM(CASE WHEN role = 'cafe_manager' THEN 1 ELSE 0 END) as cafe_managers,
        SUM(CASE WHEN role = 'guest' THEN 1 ELSE 0 END) as guests
      FROM users
    `);
    return stmt.get();
  }
}

export default UserRepository;
