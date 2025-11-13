/**
 * Helpers para stays.controllers.js
 * Extraído para reducir complejidad ciclomática en createStayHandler
 */

export function normalizeCheckInOut(input) {
  if (input.checkIn && !input.checkInDate) input.checkInDate = input.checkIn;
  if (input.checkOut && !input.checkOutDate) input.checkOutDate = input.checkOut;
}

export function ensureNumberOfGuests(input) {
  if (!input.numberOfGuests) input.numberOfGuests = 1;
}

export function calculateBasePrice(input) {
  if (!input.basePrice) {
    input.basePrice =
      input.totalPrice && input.numberOfNights
        ? Number(input.totalPrice) / Number(input.numberOfNights)
        : 100;
  }
}

export function assignDefaultUser(input, userRepository, req) {
  if (!input.userId) {
    try {
      const admins = userRepository.findAll({
        role: 'admin',
        isActive: true,
        limit: 1
      });
      if (admins?.length) {
        input.userId = admins[0].id;
      }
    } catch (_) {
      if (req.user?.sub) {
        input.userId = req.user.sub;
      }
    }
  }
}
