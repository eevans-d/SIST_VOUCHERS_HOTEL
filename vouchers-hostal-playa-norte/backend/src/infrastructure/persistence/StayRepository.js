import { Stay } from '../../domain/entities/Stay.js';

export class StayRepository {
  constructor(database) {
    this.db = database;
  }

  async findById(id) {
    const row = this.db.prepare('SELECT * FROM stays WHERE id = ?').get(id);
    return row ? Stay.fromPersistence(row) : null;
  }

  async save(stay) {
    const data = stay.toPersistence();
    this.db.prepare('INSERT INTO stays (id, userId, hotelCode, roomNumber, checkInDate, checkOutDate, numberOfGuests, numberOfNights, roomType, basePrice, totalPrice, status, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
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
  }

  async update(stay) {
    const data = stay.toPersistence();
    this.db.prepare('UPDATE stays SET status = ?, notes = ?, updatedAt = ? WHERE id = ?').run(
      data.status,
      data.notes,
      data.updatedAt,
      data.id
    );
  }
}

export default StayRepository;
