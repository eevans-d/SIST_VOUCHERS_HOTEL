import { describe, it, expect, beforeEach } from '@jest/globals';
import GraphQLService from '../services/graphqlService.js';

describe('GraphQLService', () => {
  let graphqlService;

  beforeEach(() => {
    graphqlService = new GraphQLService({
      contextValue: {},
      resolvers: {},
      plugins: [],
    });
  });

  describe('Initialization', () => {
    it('should create service instance', () => {
      expect(graphqlService).toBeDefined();
      expect(graphqlService.server).toBeNull();
    });

    it('should set default options', () => {
      expect(graphqlService.stats.queriesExecuted).toBe(0);
      expect(graphqlService.stats.mutationsExecuted).toBe(0);
    });

    it('should initialize Apollo server', async () => {
      const server = await graphqlService.initialize({ debug: false });
      expect(server).toBeDefined();
    });
  });

  describe('Type Definitions', () => {
    it('should have Query type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Query');
    });

    it('should have Mutation type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Mutation');
    });

    it('should have Subscription type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Subscription');
    });

    it('should define User type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type User');
    });

    it('should define Order type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Order');
    });

    it('should define Guest type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Guest');
    });

    it('should define Room type', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('type Room');
    });

    it('should have DateTime scalar', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('scalar DateTime');
    });

    it('should have OrderStatus enum', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('enum OrderStatus');
    });

    it('should have RoomType enum', () => {
      const typeDefs = graphqlService.getTypeDefs();
      expect(typeDefs).toContain('enum RoomType');
    });
  });

  describe('Query Resolvers', () => {
    beforeEach(() => {
      graphqlService.queryDatabase = jest.fn().mockResolvedValue([
        {
          id: '1',
          email: 'user@example.com',
          name: 'John Doe',
        },
      ]);
    });

    it('should record query execution', async () => {
      await graphqlService.resolveUser(null, { id: '1' }, {});
      expect(graphqlService.stats.queriesExecuted).toBe(1);
    });

    it('should resolve user by ID', async () => {
      const user = await graphqlService.resolveUser(null, { id: '1' }, {});
      expect(user[0]?.id).toBe('1');
    });

    it('should resolve multiple users', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', email: 'user1@example.com' },
        { id: '2', email: 'user2@example.com' },
      ]);

      const users = await graphqlService.resolveUsers(null, { limit: 10, offset: 0 });
      expect(users.length).toBe(2);
    });

    it('should resolve user by email', async () => {
      const user = await graphqlService.resolveUserByEmail(null, { email: 'user@example.com' }, {});
      expect(user).toBeDefined();
    });

    it('should resolve order by ID', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', userId: '1', status: 'COMPLETED' },
      ]);

      const order = await graphqlService.resolveOrder(null, { id: '1' }, {});
      expect(order[0]?.id).toBe('1');
    });

    it('should resolve orders with pagination', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', status: 'COMPLETED' },
        { id: '2', status: 'PENDING' },
      ]);

      graphqlService.countOrders = jest.fn().mockResolvedValue(100);

      const result = await graphqlService.resolveOrders(null, {
        limit: 20,
        offset: 0,
      });

      expect(result.items.length).toBe(2);
      expect(result.totalCount).toBe(100);
    });

    it('should filter orders by status', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', status: 'COMPLETED' },
      ]);

      const result = await graphqlService.resolveOrders(null, {
        status: 'COMPLETED',
      });

      expect(result.items[0]?.status).toBe('COMPLETED');
    });

    it('should filter orders by userId', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', userId: '1' },
      ]);

      const result = await graphqlService.resolveOrders(null, {
        userId: '1',
      });

      expect(result.items[0]?.userId).toBe('1');
    });

    it('should resolve order stats', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        {
          totalOrders: 100,
          completedOrders: 80,
          pendingOrders: 20,
          totalRevenue: 5000,
          averageOrderValue: 50,
        },
      ]);

      const stats = await graphqlService.resolveOrderStats();

      expect(stats.totalOrders).toBe(100);
      expect(stats.totalRevenue).toBe(5000);
    });

    it('should resolve room by ID', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', roomNumber: '101', type: 'DOUBLE' },
      ]);

      const room = await graphqlService.resolveRoom(null, { id: '1' });
      expect(room[0]?.roomNumber).toBe('101');
    });

    it('should resolve available rooms', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', available: true },
      ]);

      const rooms = await graphqlService.resolveRooms(null, { available: true });
      expect(rooms.length).toBe(1);
    });

    it('should resolve guest by ID', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', firstName: 'John', lastName: 'Doe' },
      ]);

      const guest = await graphqlService.resolveGuest(null, { id: '1' });
      expect(guest[0]?.firstName).toBe('John');
    });

    it('should resolve guests list', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { id: '1', firstName: 'John' },
        { id: '2', firstName: 'Jane' },
      ]);

      const guests = await graphqlService.resolveGuests(null, { limit: 10 });
      expect(guests.length).toBe(2);
    });
  });

  describe('Mutation Resolvers', () => {
    beforeEach(() => {
      graphqlService.insertDatabase = jest.fn().mockResolvedValue({ lastID: 1 });
      graphqlService.updateDatabase = jest.fn().mockResolvedValue({});
      graphqlService.deleteDatabase = jest.fn().mockResolvedValue({});
      graphqlService.queryDatabase = jest.fn().mockResolvedValue([
        { id: '1', email: 'user@example.com', name: 'John' },
      ]);
    });

    it('should record mutation execution', async () => {
      await graphqlService.mutationCreateUser(null, {
        email: 'test@example.com',
        name: 'Test User',
      }, {});

      expect(graphqlService.stats.mutationsExecuted).toBe(1);
    });

    it('should create user', async () => {
      const user = await graphqlService.mutationCreateUser(null, {
        email: 'new@example.com',
        name: 'New User',
      }, {});

      expect(graphqlService.insertDatabase).toHaveBeenCalled();
      expect(user.email).toBe('new@example.com');
    });

    it('should validate required fields for user creation', async () => {
      expect(() => {
        graphqlService.mutationCreateUser(null, { name: 'Test' }, {});
      }).toThrow();
    });

    it('should update user', async () => {
      await graphqlService.mutationUpdateUser(null, {
        id: '1',
        name: 'Updated Name',
      }, {});

      expect(graphqlService.updateDatabase).toHaveBeenCalled();
    });

    it('should delete user', async () => {
      const result = await graphqlService.mutationDeleteUser(null, { id: '1' }, {});

      expect(graphqlService.deleteDatabase).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should create order', async () => {
      const order = await graphqlService.mutationCreateOrder(null, {
        userId: '1',
        guestId: '1',
        checkInDate: '2024-01-15',
        checkOutDate: '2024-01-20',
        roomType: 'DOUBLE',
      }, {});

      expect(graphqlService.insertDatabase).toHaveBeenCalled();
      expect(order.status).toBe('PENDING');
    });

    it('should calculate price for order', async () => {
      const price = graphqlService.calculatePrice(
        'DOUBLE',
        '2024-01-15',
        '2024-01-20'
      );

      expect(price).toBeGreaterThan(0);
    });

    it('should update order status', async () => {
      await graphqlService.mutationUpdateOrder(null, {
        id: '1',
        status: 'COMPLETED',
      }, {});

      expect(graphqlService.updateDatabase).toHaveBeenCalled();
    });

    it('should cancel order', async () => {
      await graphqlService.mutationCancelOrder(null, { id: '1' }, {});

      expect(graphqlService.updateDatabase).toHaveBeenCalled();
    });

    it('should create guest', async () => {
      const guest = await graphqlService.mutationCreateGuest(null, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      expect(graphqlService.insertDatabase).toHaveBeenCalled();
    });

    it('should update guest', async () => {
      await graphqlService.mutationUpdateGuest(null, {
        id: '1',
        firstName: 'Jane',
      }, {});

      expect(graphqlService.updateDatabase).toHaveBeenCalled();
    });

    it('should create room', async () => {
      const room = await graphqlService.mutationCreateRoom(null, {
        roomNumber: '101',
        type: 'DOUBLE',
        price: 80,
        capacity: 2,
      });

      expect(graphqlService.insertDatabase).toHaveBeenCalled();
    });

    it('should update room', async () => {
      await graphqlService.mutationUpdateRoom(null, {
        id: '1',
        price: 100,
      });

      expect(graphqlService.updateDatabase).toHaveBeenCalled();
    });
  });

  describe('Field Resolvers', () => {
    beforeEach(() => {
      graphqlService.queryDatabase = jest.fn().mockResolvedValue([
        { id: '1', userId: '1', status: 'COMPLETED' },
      ]);
    });

    it('should resolve user orders', async () => {
      const orders = await graphqlService.resolveUserOrders(
        { id: '1' },
        { limit: 10 }
      );

      expect(orders).toBeDefined();
    });

    it('should resolve user order count', async () => {
      graphqlService.queryDatabase.mockResolvedValue([
        { count: 5 },
      ]);

      const count = await graphqlService.resolveUserOrderCount({ id: '1' });

      expect(count).toBe(5);
    });

    it('should resolve order user', async () => {
      const user = await graphqlService.resolveOrderUser(
        { userId: '1' }
      );

      expect(user).toBeDefined();
    });

    it('should resolve order guest', async () => {
      const guest = await graphqlService.resolveOrderGuest(
        { guestId: '1' }
      );

      expect(guest).toBeDefined();
    });
  });

  describe('Scalar Types', () => {
    it('should have DateTime scalar', () => {
      const scalar = graphqlService.dateTimeScalar();

      expect(scalar.parseValue).toBeDefined();
      expect(scalar.serialize).toBeDefined();
      expect(scalar.parseLiteral).toBeDefined();
    });

    it('should serialize DateTime', () => {
      const scalar = graphqlService.dateTimeScalar();
      const date = new Date('2024-01-15');
      const serialized = scalar.serialize(date);

      expect(typeof serialized).toBe('string');
      expect(serialized).toContain('2024-01-15');
    });

    it('should parse DateTime string', () => {
      const scalar = graphqlService.dateTimeScalar();
      const parsed = scalar.parseValue('2024-01-15');

      expect(parsed).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should format errors', () => {
      const error = new Error('Test error');
      error.extensions = { code: 'BAD_REQUEST' };

      const formatted = graphqlService.defaultFormatError(error);

      expect(formatted.message).toBe('Test error');
      expect(formatted.code).toBe('BAD_REQUEST');
    });

    it('should validate input', () => {
      expect(() => {
        graphqlService.validateInput({
          email: 'test@example.com',
          name: null,
        });
      }).toThrow();
    });

    it('should handle missing required fields', () => {
      expect(() => {
        graphqlService.validateInput({
          email: undefined,
          name: 'Test',
        });
      }).toThrow();
    });
  });

  describe('Context Creation', () => {
    it('should create context from request', async () => {
      const req = {
        headers: {
          'x-user-id': '123',
          'authorization': 'Bearer token',
        },
      };

      const context = await graphqlService.createContext({ req });

      expect(context.userId).toBe('123');
      expect(context.token).toBe('Bearer token');
    });

    it('should create context without request', async () => {
      const context = await graphqlService.createContext({});

      expect(context).toBeDefined();
      expect(context.dataloaders).toBeDefined();
    });
  });

  describe('Resolvers', () => {
    it('should return resolver object', () => {
      const resolvers = graphqlService.getResolvers();

      expect(resolvers.Query).toBeDefined();
      expect(resolvers.Mutation).toBeDefined();
      expect(resolvers.Subscription).toBeDefined();
    });

    it('should have all query resolvers', () => {
      const resolvers = graphqlService.getResolvers();

      expect(resolvers.Query.user).toBeDefined();
      expect(resolvers.Query.users).toBeDefined();
      expect(resolvers.Query.orders).toBeDefined();
      expect(resolvers.Query.orderStats).toBeDefined();
    });

    it('should have all mutation resolvers', () => {
      const resolvers = graphqlService.getResolvers();

      expect(resolvers.Mutation.createUser).toBeDefined();
      expect(resolvers.Mutation.updateUser).toBeDefined();
      expect(resolvers.Mutation.createOrder).toBeDefined();
    });

    it('should have subscription resolvers', () => {
      const resolvers = graphqlService.getResolvers();

      expect(resolvers.Subscription.orderCreated).toBeDefined();
      expect(resolvers.Subscription.orderCancelled).toBeDefined();
    });
  });

  describe('Price Calculation', () => {
    it('should calculate price for SINGLE room', () => {
      const price = graphqlService.calculatePrice(
        'SINGLE',
        '2024-01-15',
        '2024-01-20'
      );

      expect(price).toBe(250);  // 50 * 5 days
    });

    it('should calculate price for DOUBLE room', () => {
      const price = graphqlService.calculatePrice(
        'DOUBLE',
        '2024-01-15',
        '2024-01-20'
      );

      expect(price).toBe(400);  // 80 * 5 days
    });

    it('should calculate price for SUITE room', () => {
      const price = graphqlService.calculatePrice(
        'SUITE',
        '2024-01-15',
        '2024-01-20'
      );

      expect(price).toBe(750);  // 150 * 5 days
    });

    it('should calculate price for DELUXE room', () => {
      const price = graphqlService.calculatePrice(
        'DELUXE',
        '2024-01-15',
        '2024-01-20'
      );

      expect(price).toBe(1250);  // 250 * 5 days
    });

    it('should handle same-day checkout as 1 day', () => {
      const price = graphqlService.calculatePrice(
        'DOUBLE',
        '2024-01-15',
        '2024-01-15'
      );

      expect(price).toBe(80);  // 80 * 1 day
    });
  });

  describe('Statistics', () => {
    it('should track query execution count', async () => {
      graphqlService.queryDatabase.mockResolvedValue([]);

      await graphqlService.resolveUsers(null, {});
      await graphqlService.resolveUsers(null, {});

      const stats = graphqlService.getStats();
      expect(stats.queriesExecuted).toBe(2);
    });

    it('should track mutation execution count', async () => {
      graphqlService.insertDatabase.mockResolvedValue({ lastID: 1 });
      graphqlService.queryDatabase.mockResolvedValue([]);

      await graphqlService.mutationCreateUser(null, {
        email: 'test@example.com',
        name: 'Test',
      }, {});

      const stats = graphqlService.getStats();
      expect(stats.mutationsExecuted).toBe(1);
    });

    it('should return stats object', () => {
      const stats = graphqlService.getStats();

      expect(stats).toHaveProperty('queriesExecuted');
      expect(stats).toHaveProperty('mutationsExecuted');
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', () => {
      const health = graphqlService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('GraphQLService');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should include stats in health check', () => {
      const health = graphqlService.healthCheck();

      expect(health.stats).toBeDefined();
      expect(health.stats).toHaveProperty('queriesExecuted');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null parameters', async () => {
      graphqlService.queryDatabase.mockResolvedValue([]);

      const result = await graphqlService.resolveUsers(null, {
        limit: null,
        offset: null,
      });

      expect(result).toBeDefined();
    });

    it('should handle empty query results', async () => {
      graphqlService.queryDatabase.mockResolvedValue([]);

      const stats = await graphqlService.resolveOrderStats();

      expect(stats).toBeDefined();
    });
  });
});
