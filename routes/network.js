'use strict';

const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const socketService = require('../services/socketService');

const router = express.Router();

// All network routes are protected
router.use(authenticate);

// ──────────────────────────────────────────────
// GET /api/network/connections — accepted connections
// ──────────────────────────────────────────────

router.get('/connections', (req, res) => {
  try {
    const userId = req.user.id;

    const connections = db
      .prepare(
        `SELECT
           c.id           AS connection_id,
           c.created_at   AS connected_at,
           CASE
             WHEN c.sender_id = ? THEN c.receiver_id
             ELSE c.sender_id
           END AS user_id,
           u.name, u.email, u.title, u.bio, u.avatar_url
         FROM connections c
         JOIN users u ON u.id = CASE
             WHEN c.sender_id = ? THEN c.receiver_id
             ELSE c.sender_id
           END
         WHERE (c.sender_id = ? OR c.receiver_id = ?)
           AND c.status = 'accepted'
         ORDER BY c.created_at DESC`
      )
      .all(userId, userId, userId, userId);

    res.json({ connections, count: connections.length });
  } catch (err) {
    console.error('[Network] List connections error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/network/pending — pending requests (received)
// ──────────────────────────────────────────────

router.get('/pending', (req, res) => {
  try {
    const userId = req.user.id;

    const incoming = db
      .prepare(
        `SELECT
           c.id AS connection_id, c.created_at,
           u.id AS user_id, u.name, u.email, u.title, u.avatar_url
         FROM connections c
         JOIN users u ON u.id = c.sender_id
         WHERE c.receiver_id = ? AND c.status = 'pending'
         ORDER BY c.created_at DESC`
      )
      .all(userId);

    const outgoing = db
      .prepare(
        `SELECT
           c.id AS connection_id, c.created_at,
           u.id AS user_id, u.name, u.email, u.title, u.avatar_url
         FROM connections c
         JOIN users u ON u.id = c.receiver_id
         WHERE c.sender_id = ? AND c.status = 'pending'
         ORDER BY c.created_at DESC`
      )
      .all(userId);

    res.json({ incoming, outgoing });
  } catch (err) {
    console.error('[Network] Pending error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// POST /api/network/connect — send connection request
// ──────────────────────────────────────────────

router.post('/connect', (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ error: 'receiver_id is required.' });
    }

    const receiverId = parseInt(receiver_id, 10);
    if (isNaN(receiverId)) {
      return res.status(400).json({ error: 'Invalid receiver_id.' });
    }
    if (receiverId === senderId) {
      return res.status(400).json({ error: 'You cannot connect with yourself.' });
    }

    // Verify receiver exists
    const receiver = db.prepare('SELECT id, name FROM users WHERE id = ?').get(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if a connection already exists (in either direction)
    const existing = db
      .prepare(
        `SELECT * FROM connections
         WHERE (sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?)`
      )
      .get(senderId, receiverId, receiverId, senderId);

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: 'You are already connected.' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ error: 'A pending request already exists.' });
      }
      if (existing.status === 'rejected') {
        // Allow re-sending after rejection — update the existing row
        db.prepare(
          `UPDATE connections SET sender_id = ?, receiver_id = ?, status = 'pending', created_at = datetime('now')
           WHERE id = ?`
        ).run(senderId, receiverId, existing.id);

        const updated = db.prepare('SELECT * FROM connections WHERE id = ?').get(existing.id);

        // Notify the receiver
        createNotification(
          receiverId,
          'connection_request',
          `${req.user.email} sent you a connection request.`,
          { senderId }
        );

        return res.json({ message: 'Connection request re-sent.', connection: updated });
      }
    }

    // Create new connection request
    const result = db
      .prepare('INSERT INTO connections (sender_id, receiver_id, status) VALUES (?, ?, ?)')
      .run(senderId, receiverId, 'pending');

    const connection = db.prepare('SELECT * FROM connections WHERE id = ?').get(result.lastInsertRowid);

    // Create notification for receiver
    const senderUser = db.prepare('SELECT name FROM users WHERE id = ?').get(senderId);
    createNotification(
      receiverId,
      'connection_request',
      `${senderUser.name} sent you a connection request.`,
      { senderId, connectionId: connection.id }
    );

    res.status(201).json({ message: 'Connection request sent.', connection });
  } catch (err) {
    console.error('[Network] Connect error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// PUT /api/network/respond/:id — accept / reject
// ──────────────────────────────────────────────

router.put('/respond/:id', (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(connectionId)) {
      return res.status(400).json({ error: 'Invalid connection ID.' });
    }
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "accepted" or "rejected".' });
    }

    const connection = db
      .prepare('SELECT * FROM connections WHERE id = ? AND receiver_id = ? AND status = ?')
      .get(connectionId, req.user.id, 'pending');

    if (!connection) {
      return res.status(404).json({ error: 'Pending connection request not found.' });
    }

    db.prepare('UPDATE connections SET status = ? WHERE id = ?').run(status, connectionId);

    // Notify the original sender
    const responderUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    createNotification(
      connection.sender_id,
      'connection_response',
      `${responderUser.name} ${status} your connection request.`,
      { responderId: req.user.id, connectionId, status }
    );

    res.json({
      message: `Connection request ${status}.`,
      connection: { ...connection, status },
    });
  } catch (err) {
    console.error('[Network] Respond error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/network/suggestions — suggest unconnected users
// ──────────────────────────────────────────────

router.get('/suggestions', (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const suggestions = db
      .prepare(
        `SELECT id, name, email, title, bio, avatar_url
         FROM users
         WHERE id != ?
           AND id NOT IN (
             SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
             FROM connections
             WHERE (sender_id = ? OR receiver_id = ?)
               AND status IN ('pending', 'accepted')
           )
         ORDER BY RANDOM()
         LIMIT ?`
      )
      .all(userId, userId, userId, userId, limit);

    res.json({ suggestions });
  } catch (err) {
    console.error('[Network] Suggestions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// Helper — create notification & push via socket
// ──────────────────────────────────────────────

function createNotification(userId, type, message, data = {}) {
  try {
    const result = db
      .prepare(
        `INSERT INTO notifications (user_id, type, message, data_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(userId, type, message, JSON.stringify(data));

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);

    // Real-time push
    socketService.notifyUser(userId, notification);

    return notification;
  } catch (err) {
    console.error('[Notification] Create error:', err);
    return null;
  }
}

module.exports = router;
