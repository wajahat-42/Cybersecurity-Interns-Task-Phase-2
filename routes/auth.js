const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

const registerValidation = [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username: 3-30 chars, alphanumeric + underscore'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password: min 8 chars, needs uppercase, lowercase, number'),
];

// POST /api/auth/register
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password } = req.body;
  const db = getDB();

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = uuidv4();

    // SECURE: Prepared statement prevents SQL injection
    // VULNERABLE (never do this): db.exec(`INSERT INTO users VALUES ('${username}','${password}')`)
    const result = db.prepare('INSERT INTO users (username, email, password, api_key) VALUES (?, ?, ?, ?)')
      .run(username, email, hashedPassword, apiKey);

    const token = jwt.sign({ userId: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'Registered successfully', token, apiKey });
  } catch (err) {
    console.error('[Register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDB();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Generic error — prevents username enumeration
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      db.prepare('INSERT INTO audit_log (user_id, action, ip_address) VALUES (?, ?, ?)')
        .run(user.id, 'LOGIN_BLOCKED', req.ip);
      return res.status(423).json({ error: 'Account locked. Try again in 15 minutes.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      const attempts = (user.login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      db.prepare('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockUntil ? lockUntil.toISOString() : null, user.id);
      db.prepare('INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)')
        .run(user.id, 'FAILED_LOGIN', `Attempt ${attempts}/5`, req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.prepare('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    db.prepare('INSERT INTO audit_log (user_id, action, ip_address) VALUES (?, ?, ?)').run(user.id, 'LOGIN_SUCCESS', req.ip);

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('[Login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
