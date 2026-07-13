/**
 * SecureNotes API — Secured Version
 * Demonstrates: Rate Limiting, CORS, Security Headers (CSP/HSTS),
 * API Key Auth, JWT Auth, SQL Injection Prevention, CSRF Protection
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure logs directory exists (for Fail2Ban monitoring)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ============================================================
// WEEK 4 — SECURITY MIDDLEWARE
// ============================================================

// 1. SECURITY HEADERS — Helmet sets X-Frame-Options, X-XSS-Protection,
//    X-Content-Type-Options, Referrer-Policy, and more automatically.
app.use(
  helmet({
    // Content Security Policy: blocks XSS by whitelisting script/style sources
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],          // No inline scripts; external blocked
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],           // Prevents clickjacking
        objectSrc: ["'none'"],
      },
    },
    // HTTP Strict Transport Security — forces HTTPS for 1 year
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// 2. CORS — Whitelist specific origins; blocks all others
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (e.g., Postman without origin header)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token'],
    credentials: true,
  })
);

// 3. RATE LIMITING — Prevents brute-force and DDoS attacks

// Global rate limit: 100 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Strict auth limiter: 5 login attempts per 15 min per IP
// Prevents automated credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Body parsing (with size limit to prevent large payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging — writes to file for Fail2Ban monitoring
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'access.log'),
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Console logging for development

// 4. SESSION — Required for CSRF token storage
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      httpOnly: true,    // Prevents JS access (XSS mitigation)
      sameSite: 'strict', // Prevents CSRF via cross-site requests
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Static files (served from public/)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', authLimiter, authRoutes);   // Auth with strict rate limit
app.use('/api/notes', notesRoutes);              // Notes with CSRF protection
app.use('/api', apiRoutes);                      // API key protected endpoints

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// ERROR HANDLERS
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  // CSRF token mismatch
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  // CORS violation
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB and start server
(async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`[SECURE]    Server: http://localhost:${PORT}`);
    console.log(`[SECURE]    Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SECURE]    All security middleware active`);
  });
})();

module.exports = app;
