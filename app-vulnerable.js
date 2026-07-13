/**
 * SecureNotes API — INTENTIONALLY VULNERABLE VERSION
 * PURPOSE: Used ONLY in Week 5 penetration testing to demonstrate
 *          vulnerabilities before they are fixed.
 *
 * DO NOT USE IN PRODUCTION.
 * Vulnerabilities present:
 *   1. SQL Injection in /search endpoint (raw string concatenation)
 *   2. No CSRF protection on POST routes
 *   3. No rate limiting (brute-force possible)
 *   4. No security headers (XSS, clickjacking possible)
 *   5. Open CORS (any origin accepted)
 *   6. Passwords stored in plaintext
 */
const express = require('express');
const { initDatabase, getDB } = require('./config/database');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001; // Different port from secure app

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// VULNERABILITY: Open CORS — accepts any origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});
// NOTE: No helmet() — no security headers at all

const vulnDbPath = path.join(__dirname, 'data', 'vulnerable.db');

(async () => {
  await initDatabase();
  const db = getDB();

  // Seed some data for SQLMap to find
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', 'admin123');
  }
  const existingAlice = db.prepare('SELECT id FROM users WHERE username = ?').get('alice');
  if (!existingAlice) {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('alice', 'password1');
  }

  const adminNote = db.prepare('SELECT id FROM notes WHERE title = ?').get('Secret Note');
  if (!adminNote) {
    db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(1, 'Secret Note', 'Confidential data here');
  }
  const aliceNote = db.prepare('SELECT id FROM notes WHERE title = ?').get('Alice Note');
  if (!aliceNote) {
    db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(2, 'Alice Note', 'Private information');
  }

  // VULNERABILITY 1: SQL INJECTION
  // The search query is built via string concatenation — never do this!
  // SQLMap will detect and exploit: GET /search?q=test' OR '1'='1
  app.get('/search', (req, res) => {
    const q = req.query.q || '';
    // VULNERABLE: Raw string concatenation into SQL query
    const query = `SELECT id, title, content FROM notes WHERE title LIKE '%${q}%'`;
    try {
      const notes = db.prepare(query).all();
      res.json(notes);
    } catch (err) {
      res.status(500).json({ error: err.message }); // VULNERABILITY: Exposes DB errors
    }
  });

  // VULNERABILITY 2: No CSRF protection
  // Any site can submit forms to this endpoint on behalf of logged-in users
  app.post('/notes', (req, res) => {
    const { user_id, title, content } = req.body;
    // No auth check, no CSRF token validation
    db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(user_id, title, content);
    res.json({ message: 'Note created' });
  });

  // VULNERABILITY 3: Login with plaintext password check
  // No rate limiting — brute-force possible
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // VULNERABLE: Plaintext password comparison
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ message: 'Login successful', userId: user.id });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/health', (req, res) => res.json({ status: 'VULNERABLE APP RUNNING', port: PORT }));

  app.listen(PORT, () => {
    console.log(`[VULNERABLE] Server: http://localhost:${PORT}`);
    console.log(`[VULNERABLE] FOR TESTING ONLY — DO NOT USE IN PRODUCTION`);
    console.log(`[VULNERABLE] SQLMap target: http://localhost:${PORT}/search?q=test`);
  });
})();
