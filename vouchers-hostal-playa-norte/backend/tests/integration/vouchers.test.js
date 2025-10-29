import request from 'supertest';
import app from '../../src/index.js';
import { Stay } from '../../src/domain/entities/Stay.js';
import { User } from '../../src/domain/entities/User.js';
import { StayRepository } from '../../src/infrastructure/persistence/StayRepository.js';
import { UserRepository } from '../../src/domain/repositories/UserRepository.js';
import { JWTService } from '../../src/infrastructure/security/JWTService.js';
import Database from 'better-sqlite3';

describe('Voucher API', () => {
  let db;
  let stayRepository;
  let userRepository;
  let jwtService;
  let user;
  let token;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE users (id TEXT, email TEXT, password TEXT, role TEXT, isActive INTEGER);
      CREATE TABLE stays (id TEXT, userId TEXT, hotelCode TEXT, roomNumber TEXT, checkInDate TEXT, checkOutDate TEXT, numberOfGuests INTEGER, numberOfNights INTEGER, roomType TEXT, basePrice REAL, totalPrice REAL, status TEXT, notes TEXT, createdAt TEXT, updatedAt TEXT);
      CREATE TABLE vouchers (id TEXT, code TEXT, stayId TEXT, validFrom TEXT, validUntil TEXT, hmacSignature TEXT, status TEXT, createdAt TEXT, updatedAt TEXT);
    `);

    stayRepository = new StayRepository(db);
    userRepository = new UserRepository(db);
    jwtService = new JWTService('a-very-long-and-secret-jwt-secret-for-testing-purposes', 'a-very-long-and-secret-jwt-refresh-secret-for-testing-purposes');

    // Create a test user
    user = User.create({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
      passwordHash: 'a-very-long-and-secret-password-hash',
      role: 'admin',
    });
    userRepository.save(user);

    // Get a token
    token = jwtService.generateTokenPair(user).accessToken;
  });

  afterAll(() => {
    db.close();
  });

  describe('POST /api/vouchers/generate', () => {
    it('should generate vouchers for a stay', async () => {
      // Create a test stay
      const stay = Stay.create({
        userId: user.id,
        hotelCode: 'HPN',
        roomNumber: '101',
        checkInDate: new Date(),
        checkOutDate: new Date(new Date().setDate(new Date().getDate() + 2)),
        numberOfGuests: 2,
        numberOfNights: 2,
        roomType: 'double',
        basePrice: 100,
        totalPrice: 200,
      });
      stayRepository.save(stay);

      const response = await request(app)
        .post('/api/vouchers/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ stayId: stay.id, numberOfVouchers: 2 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].stayId).toBe(stay.id);
    });
  });
});
