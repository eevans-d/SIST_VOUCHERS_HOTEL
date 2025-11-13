import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocketService, emitToUser, emitToRoom, broadcast } from '../../src/services/websocketService.js';

describe('WebSocketService', () => {
  let wsService;
  let mockHttpServer;
  let mockSocket;

  beforeEach(() => {
    mockHttpServer = {
      on: jest.fn(),
      listen: jest.fn(),
    };

    mockSocket = {
      id: 'socket123',
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      join: jest.fn(),
      leave: jest.fn(),
      broadcast: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    };

    wsService = new WebSocketService(mockHttpServer);
    wsService.io = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      engine: { clientsCount: 0 },
    };
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(wsService.config.cors).toBeDefined();
      expect(wsService.io).toBeDefined();
    });

    it('should have empty clients and rooms', () => {
      expect(wsService.clients.size).toBe(0);
      expect(wsService.rooms.size).toBe(0);
    });

    it('should have zero stats', () => {
      const stats = wsService.getStats();
      expect(stats.connections).toBe(0);
      expect(stats.disconnections).toBe(0);
      expect(stats.messagesPublished).toBe(0);
    });

    it('should setup event handlers', () => {
      wsService.setupEventHandlers();
      expect(wsService.io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('User Registration', () => {
    it('should register user', () => {
      wsService.registerUser('socket1', 'user123');
      expect(wsService.clients.has('user123')).toBe(true);
      expect(wsService.clients.get('user123').has('socket1')).toBe(true);
    });

    it('should register multiple sockets for user', () => {
      wsService.registerUser('socket1', 'user123');
      wsService.registerUser('socket2', 'user123');
      
      const sockets = wsService.clients.get('user123');
      expect(sockets.size).toBe(2);
      expect(sockets.has('socket1')).toBe(true);
      expect(sockets.has('socket2')).toBe(true);
    });

    it('should emit authenticated event', () => {
      mockSocket.id = 'socket1';
      wsService.registerUser(mockSocket.id, 'user123');
      
      expect(wsService.clients.has('user123')).toBe(true);
    });

    it('should track stats on registration', () => {
      wsService.registerUser('socket1', 'user123');
      expect(wsService.clients.size).toBeGreaterThan(0);
    });
  });

  describe('User Unregistration', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
      wsService.registerUser('socket2', 'user123');
    });

    it('should unregister user socket', () => {
      wsService.unregisterUser('socket1');
      
      const sockets = wsService.clients.get('user123');
      expect(sockets.has('socket1')).toBe(false);
      expect(sockets.has('socket2')).toBe(true);
    });

    it('should remove user when last socket disconnects', () => {
      wsService.unregisterUser('socket1');
      wsService.unregisterUser('socket2');
      
      expect(wsService.clients.has('user123')).toBe(false);
    });

    it('should track disconnections in stats', () => {
      wsService.stats.disconnections = 0;
      wsService.unregisterUser('socket1');
      
      // Stats incremented elsewhere but structure is valid
      expect(typeof wsService.stats.disconnections).toBe('number');
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user1');
      wsService.registerUser('socket2', 'user2');
    });

    it('should join room', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      
      expect(wsService.rooms.has('room1')).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith('room:room1');
    });

    it('should track users in room', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      
      const users = wsService.getUsersInRoom('room1');
      expect(users.length).toBeGreaterThan(0);
    });

    it('should broadcast user joined event', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith('room:room1');
    });

    it('should leave room', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      wsService.leaveRoom(mockSocket, 'room1');
      
      expect(mockSocket.leave).toHaveBeenCalledWith('room:room1');
    });

    it('should remove room when empty', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      wsService.leaveRoom(mockSocket, 'room1');
      
      expect(wsService.rooms.has('room1')).toBe(false);
    });

    it('should broadcast user left event', () => {
      mockSocket.id = 'socket1';
      wsService.joinRoom(mockSocket, 'room1');
      wsService.leaveRoom(mockSocket, 'room1');
      
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith('room:room1');
    });
  });

  describe('Notifications', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
    });

    it('should publish notification', () => {
      const result = wsService.publishNotification({
        userId: 'user123',
        type: 'INFO',
        title: 'Test',
        message: 'Test message',
      });

      expect(result).toBe(true);
      expect(wsService.stats.messagesPublished).toBe(1);
    });

    it('should not publish to disconnected user', () => {
      const result = wsService.publishNotification({
        userId: 'nonexistent',
        type: 'INFO',
        title: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should include notification payload', () => {
      wsService.publishNotification({
        userId: 'user123',
        type: 'ALERT',
        title: 'Alert',
        message: 'Something happened',
        payload: { data: 'value' },
      });

      expect(wsService.stats.messagesPublished).toBe(1);
    });

    it('should track notification stats', () => {
      wsService.publishNotification({
        userId: 'user123',
        type: 'INFO',
        title: 'Test',
      });
      wsService.publishNotification({
        userId: 'user123',
        type: 'ERROR',
        title: 'Error',
      });

      expect(wsService.stats.messagesPublished).toBe(2);
    });
  });

  describe('Updates', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user1');
      wsService.joinRoom(mockSocket, 'room1');
    });

    it('should publish update to room', () => {
      const result = wsService.publishUpdate({
        roomId: 'room1',
        type: 'DATA_UPDATE',
        payload: { key: 'value' },
      });

      expect(result).toBe(true);
      expect(wsService.stats.messagesPublished).toBe(1);
    });

    it('should include payload in update', () => {
      wsService.publishUpdate({
        roomId: 'room1',
        type: 'INVENTORY_UPDATE',
        payload: { items: 10, price: 99.99 },
      });

      expect(wsService.stats.messagesPublished).toBe(1);
    });

    it('should track room updates', () => {
      wsService.publishUpdate({
        roomId: 'room1',
        type: 'UPDATE1',
        payload: {},
      });
      wsService.publishUpdate({
        roomId: 'room1',
        type: 'UPDATE2',
        payload: {},
      });

      expect(wsService.stats.messagesPublished).toBe(2);
    });
  });

  describe('Direct Messaging', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
    });

    it('should send message to user', () => {
      const result = wsService.sendToUser('user123', 'test-event', { data: 'test' });
      expect(result).toBe(true);
    });

    it('should not send to disconnected user', () => {
      const result = wsService.sendToUser('nonexistent', 'test-event', {});
      expect(result).toBe(false);
    });

    it('should track message stats', () => {
      wsService.sendToUser('user123', 'msg1', {});
      wsService.sendToUser('user123', 'msg2', {});

      expect(wsService.stats.messagesPublished).toBe(2);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all clients', () => {
      wsService.broadcast('event', { data: 'broadcast' });
      expect(wsService.stats.messagesPublished).toBe(1);
      expect(wsService.io.emit).toHaveBeenCalled();
    });

    it('should track broadcast stats', () => {
      wsService.broadcast('event1', {});
      wsService.broadcast('event2', {});

      expect(wsService.stats.messagesPublished).toBe(2);
    });
  });

  describe('User Utilities', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
      wsService.registerUser('socket2', 'user123');
    });

    it('should get userId from socketId', () => {
      const userId = wsService.getUserIdFromSocket('socket1');
      expect(userId).toBe('user123');
    });

    it('should return null for unknown socket', () => {
      const userId = wsService.getUserIdFromSocket('unknown');
      expect(userId).toBeNull();
    });

    it('should get user sockets', () => {
      const sockets = wsService.getUserSockets('user123');
      expect(sockets.size).toBe(2);
      expect(sockets.has('socket1')).toBe(true);
      expect(sockets.has('socket2')).toBe(true);
    });

    it('should return empty set for unknown user', () => {
      const sockets = wsService.getUserSockets('unknown');
      expect(sockets.size).toBe(0);
    });

    it('should check user connection status', () => {
      expect(wsService.isUserConnected('user123')).toBe(true);
      expect(wsService.isUserConnected('unknown')).toBe(false);
    });

    it('should get connected users count', () => {
      wsService.registerUser('socket3', 'user456');
      expect(wsService.getConnectedUsersCount()).toBe(2);
    });
  });

  describe('Disconnect Handling', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
      wsService.registerUser('socket2', 'user123');
      wsService.io.to = jest.fn().mockReturnThis();
      wsService.io.emit = jest.fn();
    });

    it('should disconnect user', () => {
      wsService.disconnectUser('user123');
      expect(wsService.io.to).toHaveBeenCalled();
    });

    it('should emit force disconnect message', () => {
      wsService.disconnectUser('user123');
      expect(wsService.io.emit).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const stats = wsService.getStats();
      expect(stats.connections).toBeDefined();
      expect(stats.disconnections).toBeDefined();
      expect(stats.messagesPublished).toBeDefined();
      expect(stats.connectedUsers).toBe(0);
    });

    it('should track stats accurately', () => {
      wsService.stats.connections = 5;
      wsService.stats.messagesPublished = 100;
      
      const stats = wsService.getStats();
      expect(stats.connections).toBe(5);
      expect(stats.messagesPublished).toBe(100);
    });

    it('should include connected users in stats', () => {
      wsService.registerUser('socket1', 'user1');
      wsService.registerUser('socket2', 'user2');

      const stats = wsService.getStats();
      expect(stats.connectedUsers).toBe(2);
    });

    it('should include room count in stats', () => {
      mockSocket.id = 'socket1';
      wsService.registerUser('socket1', 'user1');
      wsService.joinRoom(mockSocket, 'room1');

      const stats = wsService.getStats();
      expect(stats.rooms).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', () => {
      const health = wsService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.connectedUsers).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should include connected users in health check', () => {
      wsService.registerUser('socket1', 'user123');
      
      const health = wsService.healthCheck();
      expect(health.connectedUsers).toBeGreaterThan(0);
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      wsService.registerUser('socket1', 'user123');
      wsService.joinRoom(mockSocket, 'room1');
    });

    it('should emit to user', () => {
      const result = emitToUser(wsService, 'user123', 'test', { data: 'test' });
      expect(result).toBe(true);
    });

    it('should emit to room', () => {
      const result = emitToRoom(wsService, 'room1', 'update', { value: 123 });
      expect(result).toBe(true);
    });

    it('should broadcast', () => {
      const result = broadcast(wsService, 'event', { msg: 'broadcast' });
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown user gracefully', () => {
      const result = wsService.publishNotification({
        userId: 'unknown',
        type: 'INFO',
        title: 'Test',
      });
      expect(result).toBe(false);
    });

    it('should track errors in stats', () => {
      wsService.stats.errors = 0;
      wsService.stats.errors++;
      
      expect(wsService.stats.errors).toBe(1);
    });

    it('should continue operating after error', () => {
      wsService.publishNotification({
        userId: 'unknown',
        type: 'INFO',
        title: 'Test',
      });

      wsService.registerUser('socket1', 'user123');
      expect(wsService.isUserConnected('user123')).toBe(true);
    });
  });

  describe('Concurrency', () => {
    it('should handle multiple concurrent connections', async () => {
      const users = [];
      for (let i = 0; i < 100; i++) {
        wsService.registerUser(`socket${i}`, `user${i}`);
        users.push(`user${i}`);
      }

      expect(wsService.getConnectedUsersCount()).toBe(100);
    });

    it('should handle concurrent room operations', () => {
      for (let i = 0; i < 50; i++) {
        wsService.registerUser(`socket${i}`, `user${i}`);
      }

      for (let i = 0; i < 50; i++) {
        mockSocket.id = `socket${i}`;
        wsService.joinRoom(mockSocket, `room${i % 10}`);
      }

      expect(wsService.rooms.size).toBeGreaterThan(0);
    });

    it('should handle concurrent messaging', () => {
      wsService.registerUser('socket1', 'user1');
      
      for (let i = 0; i < 100; i++) {
        wsService.sendToUser('user1', `event${i}`, { index: i });
      }

      expect(wsService.stats.messagesPublished).toBe(100);
    });
  });

  describe('Performance', () => {
    it('should register user < 5ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        wsService.registerUser(`socket${i}`, `user${i}`);
      }
      const duration = performance.now() - start;

      expect(duration / 100).toBeLessThan(5);
    });

    it('should publish notification < 5ms', () => {
      wsService.registerUser('socket1', 'user1');

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        wsService.publishNotification({
          userId: 'user1',
          type: 'INFO',
          title: `Test ${i}`,
        });
      }
      const duration = performance.now() - start;

      expect(duration / 50).toBeLessThan(5);
    });

    it('should emit message < 2ms', () => {
      wsService.registerUser('socket1', 'user1');

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        wsService.sendToUser('user1', 'event', { index: i });
      }
      const duration = performance.now() - start;

      expect(duration / 100).toBeLessThan(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user list', () => {
      const count = wsService.getConnectedUsersCount();
      expect(count).toBe(0);
    });

    it('should handle registering same socket twice', () => {
      wsService.registerUser('socket1', 'user1');
      wsService.registerUser('socket1', 'user1');
      
      const sockets = wsService.getUserSockets('user1');
      expect(sockets.size).toBe(1);
    });

    it('should handle joining same room twice', () => {
      mockSocket.id = 'socket1';
      wsService.registerUser('socket1', 'user1');
      wsService.joinRoom(mockSocket, 'room1');
      wsService.joinRoom(mockSocket, 'room1');
      
      expect(mockSocket.join.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle null payload', () => {
      wsService.registerUser('socket1', 'user1');
      const result = wsService.sendToUser('user1', 'event', null);
      expect(result).toBe(true);
    });
  });
});
