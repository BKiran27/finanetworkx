'use strict';

const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /api/users — list / search users
// ──────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));

    let users;
    let total;

    if (q && q.trim()) {
      const search = `%${q.trim()}%`;
      total = db
        .prepare('SELECT COUNT(*) AS count FROM users WHERE name LIKE ? OR email LIKE ? OR title LIKE ?')
        .get(search, search, search).count;

      users = db
        .prepare(
          `SELECT id, name, email, title, bio, avatar_url, created_at
           FROM users
           WHERE name LIKE ? OR email LIKE ? OR title LIKE ?
           ORDER BY name ASC
           LIMIT ? OFFSET ?`
        )
        .all(search, search, search, lim, offset);
    } else {
      total = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

      users = db
        .prepare(
          `SELECT id, name, email, title, bio, avatar_url, created_at
           FROM users
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(lim, offset);
    }

    res.json({
      users,
      pagination: {
        page: parseInt(page, 10),
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error('[Users] List error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/users/:id — get user profile
// ──────────────────────────────────────────────

router.get('/:id', (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = db
      .prepare(
        `SELECT id, name, email, title, bio, avatar_url, created_at
         FROM users WHERE id = ?`
      )
      .get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Also include connection count
    const connectionCount = db
      .prepare(
        `SELECT COUNT(*) AS count FROM connections
         WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'`
      )
      .get(userId, userId).count;

    // Portfolio holdings count
    const portfolioCount = db
      .prepare('SELECT COUNT(*) AS count FROM portfolios WHERE user_id = ?')
      .get(userId).count;

    res.json({
      user: {
        ...user,
        connectionCount,
        portfolioCount,
      },
    });
  } catch (err) {
    console.error('[Users] Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// PUT /api/users/profile — update own profile (protected)
// ──────────────────────────────────────────────

router.put('/profile', authenticate, (req, res) => {
  try {
    const { name, title, bio, avatar_url } = req.body;
    const userId = req.user.id;

    // Fetch current user
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!current) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedName = (name !== undefined ? name.trim() : current.name);
    const updatedTitle = (title !== undefined ? title.trim() : current.title);
    const updatedBio = (bio !== undefined ? bio.trim() : current.bio);
    const updatedAvatar = (avatar_url !== undefined ? avatar_url.trim() : current.avatar_url);

    if (updatedName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }

    db.prepare(
      `UPDATE users SET name = ?, title = ?, bio = ?, avatar_url = ? WHERE id = ?`
    ).run(updatedName, updatedTitle, updatedBio, updatedAvatar, userId);

    const user = db
      .prepare('SELECT id, name, email, title, bio, avatar_url, created_at FROM users WHERE id = ?')
      .get(userId);

    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('[Users] Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
