const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization Bearer token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'X-API-Key header required' });
  }
  const db = getDB();
  const user = db.prepare('SELECT id, username FROM users WHERE api_key = ?').get(apiKey);
  if (!user) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  req.user = user;
  next();
}

module.exports = { authenticateJWT, authenticateAPIKey };
