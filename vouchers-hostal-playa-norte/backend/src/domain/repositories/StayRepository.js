/**
 * @file StayRepository
 * @description Repositorio de Estadía con persistencia SQLite
 * @ref BLUEPRINT_ARQUITECTURA.md - Persistence Layer
 * @ref Pilar 8.1 (Data Management)
 */

import Stay from '../entities/Stay.js';

/**
 * StayRepository - Abstracción de persistencia de estadías
 * Ref: Pilar 5.1 (Repository Pattern)
 */
export class StayRepository {
  /**
   * @param {Database.Database} db - Instancia de SQLite
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Crear nueva estadía
   * @param {Stay} stay
   * @returns {Stay}
   */
  create(stay) {
    try {
      const data = stay.toPersistence();
      const stmt = this.db.prepare(`
        INSERT INTO stays (
          id, userId, hotelCode, roomNumber, checkInDate, checkOutDate,
          numberOfGuests, numberOfNights, roomType, basePrice, totalPrice,
          status, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.id,
        data.userId,
        data.hotelCode,
        data.roomNumber,
        data.checkInDate,
        data.checkOutDate,
        data.numberOfGuests,
        data.numberOfNights,
        data.roomType,
        data.basePrice,
        data.totalPrice,
        data.status,
        data.notes,
        data.createdAt,
        data.updatedAt
      );

      return stay;
    } catch (error) {
      throw new Error(`Error creando stay: ${error.message}`);
    }
  }

  /**
   * Obtener estadía por ID
   * @param {string} id - UUID de la estadía
   * @returns {Stay|null}
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM stays WHERE id = ?');
    const row = stmt.get(id);
    return row ? Stay.fromPersistence(row) : null;
  }

  /**
   * Obtener todas las estadías de un usuario
   * @param {string} userId - UUID del usuario
   * @param {Object} options - { status, limit, offset, orderBy }
   * @returns {Stay[]}
   */
  findByUserId(userId, options = {}) {
    let query = 'SELECT * FROM stays WHERE userId = ?';
    const params = [userId];

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ` ORDER BY ${options.orderBy || 'checkInDate'} DESC`;

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
    return rows.map(row => Stay.fromPersistence(row));
  }

  /**
   * Obtener todas las estadías con filtros
   * @param {Object} filters - { userId, status, roomType, hotelCode, limit, offset }
   * @returns {Stay[]}
   */
  findAll(filters = {}) {
    let query = 'SELECT * FROM stays WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND userId = ?';
      params.push(filters.userId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.roomType) {
      query += ' AND roomType = ?';
      params.push(filters.roomType);
    }

    if (filters.hotelCode) {
      query += ' AND hotelCode = ?';
      params.push(filters.hotelCode);
    }

    query += ' ORDER BY checkInDate DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(row => Stay.fromPersistence(row));
  }

  /**
   * Obtener estadías activas hoy (check-in o check-out)
   * @param {string} hotelCode - Código del hotel
   * @returns {Stay[]}
   */
  findTodayCheckpoints(hotelCode) {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT * FROM stays
      WHERE hotelCode = ?
        AND status IN ('pending', 'active')
        AND (
          DATE(checkInDate) = ?
          OR DATE(checkOutDate) = ?
        )
      ORDER BY checkInDate ASC
    `);
    const rows = stmt.all(hotelCode, today, today);
    return rows.map(row => Stay.fromPersistence(row));
  }

  /**
   * Obtener estadías dentro de un rango de fechas
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {string} hotelCode
   * @returns {Stay[]}
   */
  findByDateRange(startDate, endDate, hotelCode) {
    const stmt = this.db.prepare(`
      SELECT * FROM stays
      WHERE hotelCode = ?
        AND checkInDate >= ?
        AND checkOutDate <= ?
      ORDER BY checkInDate ASC
    `);
    const rows = stmt.all(
      hotelCode,
      startDate.toISOString(),
      endDate.toISOString()
    );
    return rows.map(row => Stay.fromPersistence(row));
  }

  /**
   * Actualizar estadía
   * @param {string} id
   * @param {Partial<Stay>} updates
   * @returns {Stay}
   */
  update(id, updates) {
    const stay = this.findById(id);
    if (!stay) {
      throw new Error(`Estadía no encontrada: ${id}`);
    }

    Object.assign(stay, updates);
    stay.updatedAt = new Date();

    const data = stay.toPersistence();
    const stmt = this.db.prepare(`
      UPDATE stays SET
        roomNumber = ?, numberOfGuests = ?, numberOfNights = ?,
        roomType = ?, basePrice = ?, totalPrice = ?,
        status = ?, notes = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(
      data.roomNumber,
      data.numberOfGuests,
      data.numberOfNights,
      data.roomType,
      data.basePrice,
      data.totalPrice,
      data.status,
      data.notes,
      data.updatedAt,
      id
    );

    return stay;
  }

  /**
   * Eliminar estadía (soft delete)
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const stmt = this.db.prepare(
      "UPDATE stays SET status = 'cancelled' WHERE id = ?"
    );
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Contar estadías por estado
   * @param {string} status
   * @param {string} hotelCode - Opcional
   * @returns {number}
   */
  countByStatus(status, hotelCode) {
    let query = 'SELECT COUNT(*) as total FROM stays WHERE status = ?';
    const params = [status];

    if (hotelCode) {
      query += ' AND hotelCode = ?';
      params.push(hotelCode);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);
    return result.total;
  }

  /**
   * Obtener ocupación por habitación
   * @param {string} hotelCode
   * @param {Date} date
   * @returns {Object} Mapa de roomNumber -> booleano (ocupado)
   */
  getOccupancy(hotelCode, date) {
    const dateStr = date.toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT DISTINCT roomNumber FROM stays
      WHERE hotelCode = ?
        AND status != 'cancelled'
        AND DATE(checkInDate) <= ?
        AND DATE(checkOutDate) > ?
    `);
    const rows = stmt.all(hotelCode, dateStr, dateStr);
    
    const occupancy = {};
    rows.forEach(row => {
      occupancy[row.roomNumber] = true;
    });
    return occupancy;
  }

  /**
   * Obtener estadísticas de estadías
   * @param {string} hotelCode
   * @returns {Object}
   */
  getStats(hotelCode) {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        AVG(totalPrice) as avgPrice,
        SUM(totalPrice) as totalRevenue,
        COUNT(DISTINCT userId) as uniqueGuests
      FROM stays
      WHERE hotelCode = ?
    `);
    return stmt.get(hotelCode);
  }

  /**
   * Verificar disponibilidad de habitación
   * @param {string} roomNumber
   * @param {string} hotelCode
   * @param {Date} checkInDate
   * @param {Date} checkOutDate
   * @returns {boolean}
   */
  isRoomAvailable(roomNumber, hotelCode, checkInDate, checkOutDate) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM stays
      WHERE roomNumber = ?
        AND hotelCode = ?
        AND status != 'cancelled'
        AND checkInDate < ?
        AND checkOutDate > ?
    `);
    const result = stmt.get(
      roomNumber,
      hotelCode,
      checkOutDate.toISOString(),
      checkInDate.toISOString()
    );
    return result.count === 0;
  }
}

export default StayRepository;
