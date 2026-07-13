const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateJWT } = require('../middleware/auth');
const { getDB } = require('../config/database');

// CSRF protection using express-session (not cookies)
// A unique token is generated per session; must be sent in X-CSRF-Token header
const csrfProtection = csrf({ cookie: false });

// GET /api/notes/csrf-token — client calls this first to obtain a CSRF token
router.get('/csrf-token', authenticateJWT, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// GET /api/notes
router.get('/', authenticateJWT, (req, res) => {
  const db = getDB();
  const notes = db.prepare(
    'SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.userId);
  res.json(notes);
});

// GET /api/notes/search?q=keyword  — SQL INJECTION PREVENTION
router.get('/search', authenticateJWT, [
  query('q').trim().isLength({ max: 100 }).withMessage('Search query too long'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDB();
  const term = `%${req.query.q || ''}%`;
  // SECURE: ? placeholders — value is never parsed as SQL syntax
  // VULNERABLE VERSION: `SELECT * FROM notes WHERE title LIKE '%${req.query.q}%'`
  const notes = db.prepare(
    'SELECT id, title, content, created_at FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)'
  ).all(req.user.userId, term, term);
  res.json(notes);
});

// POST /api/notes — JWT + CSRF protected
router.post('/', authenticateJWT, csrfProtection, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required'),
  body('content').trim().isLength({ max: 10000 }).withMessage('Content too long'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDB();
  const result = db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)')
    .run(req.user.userId, req.body.title, req.body.content || '');
  res.status(201).json({ id: result.lastInsertRowid, message: 'Note created' });
});

// DELETE /api/notes/:id — JWT + CSRF protected
router.delete('/:id', authenticateJWT, csrfProtection, [
  param('id').isInt({ min: 1 }).withMessage('Invalid note ID'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDB();
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .run(parseInt(req.params.id), req.user.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Note not found or unauthorized' });
  res.json({ message: 'Note deleted' });
});

module.exports = router;
