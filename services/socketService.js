'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const marketService = require('./marketService');

const JWT_SECRET = process.env.JWT_SECRET || 'finanetwork_fallback_secret_change_me';

let io = null;
let broadcastInterval = null;

/**
 * Initialize Socket.IO on the given HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initialize(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Authentication middleware ──────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.query.token ||
      null;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded; // { id, email, iat, exp }
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user.id;

    // Join a user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    console.log(`[Socket.IO] User ${userId} connected  (socket ${socket.id})`);

    // Client can join/leave additional rooms if needed
    socket.on('join-room', (room) => {
      socket.join(room);
    });

    socket.on('leave-room', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] User ${userId} disconnected (${reason})`);
    });
  });

  return io;
}

/**
 * Start broadcasting market data to all connected clients.
 * Runs every `intervalMs` milliseconds (default 30 s).
 */
function startMarketBroadcast(intervalMs = 30000) {
  if (broadcastInterval) clearInterval(broadcastInterval);

  async function broadcast() {
    if (!io) return;
    try {
      const prices = await marketService.getMarketPrices();
      io.emit('market-update', { prices, timestamp: Date.now() });
    } catch (err) {
      console.error('[Socket.IO] Market broadcast error:', err.message);
    }
  }

  // Send once immediately, then repeat
  broadcast();
  broadcastInterval = setInterval(broadcast, intervalMs);
}

/**
 * Send a notification event to a specific user.
 * @param {number} userId
 * @param {object} notification
 */
function notifyUser(userId, notification) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}

/**
 * Send a portfolio-update event to a specific user.
 * @param {number} userId
 * @param {object} data
 */
function portfolioUpdate(userId, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit('portfolio-update', data);
}

/**
 * Broadcast an arbitrary event to everyone.
 * @param {string} event
 * @param {*} data
 */
function broadcastAll(event, data) {
  if (!io) return;
  io.emit(event, data);
}

/**
 * Get the raw Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Stop market broadcast (for graceful shutdown).
 */
function stopMarketBroadcast() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
}

module.exports = {
  initialize,
  startMarketBroadcast,
  stopMarketBroadcast,
  notifyUser,
  portfolioUpdate,
  broadcastAll,
  getIO,
};
