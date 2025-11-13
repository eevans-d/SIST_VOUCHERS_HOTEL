import Stay from '../entities/Stay.js';
import { getOccupancyMap, getStayStats, checkRoomAvailability } from './stay.helpers.js';

export class StayRepository {
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
    return rows.map((row) => Stay.fromPersistence(row));
  }

  /**
   * Obtener estadías por código de hotel
   * @param {string} hotelCode
   * @returns {Stay[]}
   */
  findByHotelCode(hotelCode) {
    const stmt = this.db.prepare(`
      SELECT * FROM stays WHERE hotelCode = ? AND status = 'active'
      ORDER BY checkInDate DESC
    `);
    const rows = stmt.all(hotelCode);
    return rows.map((row) => Stay.fromPersistence(row));
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
    return rows.map((row) => Stay.fromPersistence(row));
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
    return rows.map((row) => Stay.fromPersistence(row));
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
    return rows.map((row) => Stay.fromPersistence(row));
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
      'UPDATE stays SET status = \'cancelled\' WHERE id = ?'
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

  getOccupancy(hotelCode, date) {
    return getOccupancyMap(this.db, hotelCode, date);
  }

  getStats(hotelCode) {
    return getStayStats(this.db, hotelCode);
  }

  isRoomAvailable(roomNumber, hotelCode, checkInDate, checkOutDate) {
    return checkRoomAvailability(this.db, roomNumber, hotelCode, checkInDate, checkOutDate);
  }
}

export default StayRepository;
