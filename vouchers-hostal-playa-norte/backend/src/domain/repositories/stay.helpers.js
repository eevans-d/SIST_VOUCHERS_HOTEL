/**
 * Helpers de queries y estadísticas para StayRepository.
 * Extrae métodos de reportes para reducir tamaño del archivo principal.
 */

/**
 * Obtiene ocupación de habitaciones en fecha específica.
 */
export function getOccupancyMap(db, hotelCode, date) {
  const dateStr = date.toISOString().split('T')[0];
  const stmt = db.prepare(`
    SELECT DISTINCT roomNumber FROM stays
    WHERE hotelCode = ?
      AND status != 'cancelled'
      AND DATE(checkInDate) <= ?
      AND DATE(checkOutDate) > ?
  `);
  const rows = stmt.all(hotelCode, dateStr, dateStr);
  const occupancy = {};
  rows.forEach((row) => { occupancy[row.roomNumber] = true; });
  return occupancy;
}

/**
 * Obtiene estadísticas agregadas de estadías.
 */
export function getStayStats(db, hotelCode) {
  const stmt = db.prepare(`
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
 * Verifica disponibilidad de habitación en rango de fechas.
 */
export function checkRoomAvailability(db, roomNumber, hotelCode, checkInDate, checkOutDate) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM stays
    WHERE roomNumber = ?
      AND hotelCode = ?
      AND status != 'cancelled'
      AND checkInDate < ?
      AND checkOutDate > ?
  `);
  const result = stmt.get(roomNumber, hotelCode, checkOutDate.toISOString(), checkInDate.toISOString());
  return result.count === 0;
}
