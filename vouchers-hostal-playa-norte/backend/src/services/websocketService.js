/**
 * WebSocket Service - Real-time Communication with Socket.io
 * Manages live updates, notifications, and real-time data sync
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redis from 'redis';

export class WebSocketService {
  constructor(httpServer, config = {}) {
    this.httpServer = httpServer;
    this.config = {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      ...config,
    };

    this.io = new Server(httpServer, this.config);
    this.clients = new Map(); // userId → Set of socket ids
    this.rooms = new Map();   // roomId → Set of user ids
    this.stats = {
      connections: 0,
      disconnections: 0,
      messagesPublished: 0,
      messagesReceived: 0,
      errors: 0,
    };
  }

  /**
   * Initialize WebSocket service with Redis adapter (for scaling)
   */
  async initialize() {
    try {
      // Create Redis pub/sub clients for Socket.io adapter
      const pubClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Attach Redis adapter for horizontal scaling
      this.io.adapter(createAdapter(pubClient, subClient));

      this.setupEventHandlers();
      console.log('✅ WebSocket service initialized');
      return true;
    } catch (error) {
      console.error('❌ WebSocket initialization failed:', error);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Setup Socket.io event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      this.stats.connections++;

      // Authentication & user registration
      socket.on('authenticate', (userId) => {
        this.registerUser(socket.id, userId);
      });

      // Join room
      socket.on('join-room', (roomId) => {
        this.joinRoom(socket, roomId);
      });

      // Leave room
      socket.on('leave-room', (roomId) => {
        this.leaveRoom(socket, roomId);
      });

      // Publish notification
      socket.on('publish-notification', (data) => {
        this.publishNotification(data);
      });

      // Real-time update
      socket.on('publish-update', (data) => {
        this.publishUpdate(data);
      });

      // Ping/pong for keep-alive
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.unregisterUser(socket.id);
        this.stats.disconnections++;
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error(`❌ Socket error (${socket.id}):`, error);
        this.stats.errors++;
      });
    });
  }

  /**
   * Register user (map socket to userId)
   */
  registerUser(socketId, userId) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    
    this.clients.get(userId).add(socketId);
    console.log(`👤 User registered: ${userId} (socket: ${socketId})`);
    
    // Notify user is online
    this.io.to(socketId).emit('user:authenticated', { userId, socketId });
  }

  /**
   * Unregister user
   */
  unregisterUser(socketId) {
    for (const [userId, socketIds] of this.clients) {
      if (socketIds.has(socketId)) {
        socketIds.delete(socketId);
        
        if (socketIds.size === 0) {
          this.clients.delete(userId);
          console.log(`👤 User unregistered: ${userId}`);
        }
        break;
      }
    }
  }

  /**
   * Join room
   */
  joinRoom(socket, roomId) {
    const userId = this.getUserIdFromSocket(socket.id);
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    this.rooms.get(roomId).add(userId);
    socket.join(`room:${roomId}`);
    
    console.log(`🚪 User joined room: ${userId} → ${roomId}`);
    
    // Notify others
    socket.broadcast.to(`room:${roomId}`).emit('user:joined', {
      userId,
      roomId,
      timestamp: new Date(),
    });
  }

  /**
   * Leave room
   */
  leaveRoom(socket, roomId) {
    const userId = this.getUserIdFromSocket(socket.id);
    
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    socket.leave(`room:${roomId}`);
    
    console.log(`🚪 User left room: ${userId} ← ${roomId}`);
    
    // Notify others
    socket.broadcast.to(`room:${roomId}`).emit('user:left', {
      userId,
      roomId,
      timestamp: new Date(),
    });
  }

  /**
   * Publish notification to user
   */
  publishNotification(data) {
    const { userId, type, title, message, payload } = data;
    
    if (!this.clients.has(userId)) {
      console.warn(`⚠️ User not connected: ${userId}`);
      return false;
    }

    this.io.to(`user:${userId}`).emit('notification', {
      type,
      title,
      message,
      payload,
      timestamp: new Date(),
    });

    this.stats.messagesPublished++;
    console.log(`📢 Notification sent: ${userId} (${type})`);
    return true;
  }

  /**
   * Publish update to room
   */
  publishUpdate(data) {
    const { roomId, type, payload, excludeUser } = data;
    
    const targetRoom = `room:${roomId}`;
    const emission = this.io.to(targetRoom).emit('data:update', {
      type,
      payload,
      timestamp: new Date(),
      roomId,
    });

    this.stats.messagesPublished++;
    console.log(`🔄 Update published: room ${roomId} (${type})`);
    return true;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date(),
    });

    this.stats.messagesPublished++;
    console.log(`📡 Broadcast: ${event}`);
    return true;
  }

  /**
   * Send direct message to user
   */
  sendToUser(userId, event, data) {
    if (!this.clients.has(userId)) {
      console.warn(`⚠️ User not connected: ${userId}`);
      return false;
    }

    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });

    this.stats.messagesPublished++;
    console.log(`💬 Message sent to user: ${userId} (${event})`);
    return true;
  }

  /**
   * Get userId from socketId
   */
  getUserIdFromSocket(socketId) {
    for (const [userId, socketIds] of this.clients) {
      if (socketIds.has(socketId)) {
        return userId;
      }
    }
    return null;
  }

  /**
   * Get all socket IDs for a user
   */
  getUserSockets(userId) {
    return this.clients.get(userId) || new Set();
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.clients.has(userId) && this.clients.get(userId).size > 0;
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.clients.size;
  }

  /**
   * Get users in room
   */
  getUsersInRoom(roomId) {
    return Array.from(this.rooms.get(roomId) || new Set());
  }

  /**
   * Disconnect user
   */
  disconnectUser(userId) {
    const socketIds = this.clients.get(userId);
    if (socketIds) {
      for (const socketId of socketIds) {
        this.io.to(socketId).emit('force:disconnect', {
          reason: 'Disconnected by admin',
        });
      }
    }
  }

  /**
   * Get WebSocket stats
   */
  getStats() {
    return {
      ...this.stats,
      connectedUsers: this.clients.size,
      totalSockets: this.io.engine.clientsCount,
      rooms: this.rooms.size,
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      healthy: true,
      connectedUsers: this.clients.size,
      totalSockets: this.io.engine.clientsCount,
      timestamp: new Date(),
    };
  }
}

/**
 * Middleware: Authenticate WebSocket connections
 */
export const socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('No authentication token provided'));
    }

    // Verify JWT token (similar to HTTP auth)
    // In production, use same JWT verification as HTTP
    
    socket.userId = null; // Will be set on 'authenticate' event
    next();
  } catch (error) {
    console.error('❌ Socket auth error:', error);
    next(error);
  }
};

/**
 * Emit event to specific user via WebSocket
 */
export const emitToUser = (wsService, userId, event, data) => {
  return wsService.sendToUser(userId, event, data);
};

/**
 * Emit event to room
 */
export const emitToRoom = (wsService, roomId, event, data) => {
  return wsService.publishUpdate({
    roomId,
    type: event,
    payload: data,
  });
};

/**
 * Broadcast to all
 */
export const broadcast = (wsService, event, data) => {
  return wsService.broadcast(event, data);
};

export default WebSocketService;
