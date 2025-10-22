/**
 * @file Stay.test.js
 * @description Tests unitarios para Stay Entity
 * @ref BLUEPRINT_ARQUITECTURA.md - Testing Layer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Stay from '../../../src/domain/entities/Stay';

describe('Stay Entity', () => {
  let stayData;

  beforeEach(() => {
    const checkIn = new Date('2025-11-01');
    const checkOut = new Date('2025-11-05');

    stayData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      hotelCode: 'HPN',
      roomNumber: '101',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numberOfGuests: 2,
      numberOfNights: 4,
      roomType: 'double',
      basePrice: 100,
      totalPrice: 400,
      status: 'pending',
    };
  });

  describe('create', () => {
    it('debe crear una estadía válida', () => {
      const stay = Stay.create(stayData);
      expect(stay.roomNumber).toBe('101');
      expect(stay.numberOfGuests).toBe(2);
      expect(stay.id).toBeDefined();
    });

    it('debe lanzar error si check-out no es posterior a check-in', () => {
      expect(() => {
        Stay.create({
          ...stayData,
          checkInDate: new Date('2025-11-05'),
          checkOutDate: new Date('2025-11-01'),
        });
      }).toThrow();
    });

    it('debe lanzar error si numberOfGuests es 0', () => {
      expect(() => {
        Stay.create({ ...stayData, numberOfGuests: 0 });
      }).toThrow();
    });
  });

  describe('calculateNights', () => {
    it('debe calcular cantidad de noches correctamente', () => {
      const stay = Stay.create(stayData);
      const nights = stay.calculateNights();
      expect(nights).toBe(4);
    });
  });

  describe('getDaysRemaining', () => {
    it('debe retornar 0 si ya pasó check-out', () => {
      const stay = Stay.create({
        ...stayData,
        checkInDate: new Date('2025-01-01'),
        checkOutDate: new Date('2025-01-05'),
      });
      expect(stay.getDaysRemaining()).toBe(0);
    });
  });

  describe('isActive/isCompleted/isCancelled', () => {
    it('debe identificar correctamente el status', () => {
      const stay = Stay.create(stayData);
      expect(stay.isActive()).toBe(false);
      expect(stay.isCompleted()).toBe(false);
      expect(stay.isCancelled()).toBe(false);
    });
  });

  describe('activate', () => {
    it('debe cambiar status de pending a active', () => {
      const stay = Stay.create(stayData);
      stay.activate();
      expect(stay.isActive()).toBe(true);
      expect(stay.status).toBe('active');
    });

    it('debe lanzar error si no está pending', () => {
      const stay = Stay.create({ ...stayData, status: 'active' });
      expect(() => {
        stay.activate();
      }).toThrow();
    });
  });

  describe('complete', () => {
    it('debe cambiar status a completed', () => {
      const stay = Stay.create(stayData);
      stay.activate();
      stay.complete();
      expect(stay.isCompleted()).toBe(true);
    });

    it('debe lanzar error si no está activa', () => {
      const stay = Stay.create(stayData);
      expect(() => {
        stay.complete();
      }).toThrow();
    });
  });

  describe('cancel', () => {
    it('debe cancelar estadía pendiente', () => {
      const stay = Stay.create(stayData);
      stay.cancel('Test cancellation');
      expect(stay.isCancelled()).toBe(true);
      expect(stay.notes).toContain('CANCELADA');
    });

    it('debe lanzar error si está completada', () => {
      const stay = Stay.create(stayData);
      stay.activate();
      stay.complete();
      expect(() => {
        stay.cancel();
      }).toThrow();
    });
  });

  describe('toJSON', () => {
    it('debe retornar objeto JSON con información sensible', () => {
      const stay = Stay.create(stayData);
      const json = stay.toJSON();
      expect(json.id).toBeDefined();
      expect(json.roomNumber).toBe('101');
      expect(json.daysRemaining).toBeDefined();
    });
  });

  describe('fromPersistence', () => {
    it('debe recrear desde datos de base de datos', () => {
      const stay = Stay.create(stayData);
      const persistence = stay.toPersistence();
      const recreated = Stay.fromPersistence(persistence);
      expect(recreated.id).toBe(stay.id);
      expect(recreated.roomNumber).toBe(stay.roomNumber);
    });
  });
});
