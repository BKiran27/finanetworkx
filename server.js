'use strict';

// ──────────────────────────────────────────────
// Load environment variables FIRST
// ──────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ──────────────────────────────────────────────
// Create Express app & HTTP server
// ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ──────────────────────────────────────────────
// Security & parsing middleware
// ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for SPA that loads external scripts
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple cookie parser (avoid extra dependency)
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      req.cookies[name.trim()] = decodeURIComponent(rest.join('='));
    });
  }
  next();
});

// ──────────────────────────────────────────────
// Rate limiter for auth endpoints
// ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ──────────────────────────────────────────────
// Static files
// ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────
// API routes
// ──────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const portfolioRoutes = require('./routes/portfolio');
const networkRoutes   = require('./routes/network');
const marketRoutes    = require('./routes/market');

app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/network',   networkRoutes);
app.use('/api/market',    marketRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────
// SPA fallback — serve index.html for non-API routes
// ──────────────────────────────────────────────
app.get(/^\/(?!api\/).*/, (_req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Not found' });
    }
  });
});

// 404 for unmatched API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ──────────────────────────────────────────────
// Global error handler
// ──────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ──────────────────────────────────────────────
// Initialize Socket.IO
// ──────────────────────────────────────────────
const socketService = require('./services/socketService');
socketService.initialize(server);

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║         FinaNetwork Server Running           ║
  ╠══════════════════════════════════════════════╣
  ║  Port:      ${String(PORT).padEnd(32)}║
  ║  Mode:      ${(process.env.NODE_ENV || 'development').padEnd(32)}║
  ║  API:       http://localhost:${PORT}/api       ║
  ║  Health:    http://localhost:${PORT}/api/health ║
  ╚══════════════════════════════════════════════╝
  `);

  // Start market data broadcast via WebSocket (every 30 seconds)
  socketService.startMarketBroadcast(30000);
});

// ──────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully…`);
  socketService.stopMarketBroadcast();
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
