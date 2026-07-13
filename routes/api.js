const express = require('express');
const router = express.Router();
const { authenticateAPIKey } = require('../middleware/auth');
const { getDB } = require('../config/database');

// GET /api/v1/data — API Key authenticated (X-API-Key header)
router.get('/v1/data', authenticateAPIKey, (req, res) => {
  const db = getDB();
  const stats = db.prepare('SELECT COUNT(*) as totalNotes FROM notes WHERE user_id = ?').get(req.user.id);
  res.json({ user: req.user.username, stats, timestamp: new Date().toISOString() });
});

// GET /api/v1/notes — API Key authenticated
router.get('/v1/notes', authenticateAPIKey, (req, res) => {
  const db = getDB();
  const notes = db.prepare(
    'SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ notes });
});

module.exports = router;
