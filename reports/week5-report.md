# Week 5 — Ethical Hacking Assessment Report
**Project:** SecureNotes API — Vulnerability Testing  
**Intern:** [Your Name]  
**Date:** July 2026  
**Type:** Internal Penetration Test (Test Environment)  
**Target:** http://localhost:3001 (intentionally vulnerable version)

---

## 1. Executive Summary

A penetration test was conducted on the intentionally vulnerable version of the SecureNotes API (port 3001) to identify security weaknesses before they reach production. Two critical vulnerabilities were identified and subsequently patched in the secure version (port 3000): **SQL Injection** in the search endpoint and **missing CSRF protection** on state-changing API routes.

**Risk Summary:**

| Vulnerability | Severity | Status |
|--------------|----------|--------|
| SQL Injection (search endpoint) | 🔴 Critical | ✅ Patched |
| CSRF on POST /notes | 🔴 Critical | ✅ Patched |
| No Rate Limiting | 🟠 High | ✅ Patched |
| Plaintext Passwords | 🔴 Critical | ✅ Patched |
| Missing Security Headers | 🟠 High | ✅ Patched |
| Open CORS | 🟡 Medium | ✅ Patched |

---

## 2. Scope & Methodology

**Scope:** SecureNotes API running locally on test machines only.  
**Tools Used:** Kali Linux, SQLMap, Burp Suite Community Edition  
**Methodology:** OWASP Testing Guide (OTG)  
**Phases:**
1. Reconnaissance — identify endpoints and parameters
2. Vulnerability Scanning — automated scan with SQLMap
3. Manual Testing — CSRF via Burp Suite
4. Exploitation — demonstrate impact
5. Remediation — apply fixes in secure version

---

## 3. Reconnaissance

### 3.1 Endpoint Discovery

```bash
# Enumerate endpoints
curl http://localhost:3001/health
curl http://localhost:3001/search?q=test
curl -X POST http://localhost:3001/login
```

**Endpoints discovered:**
- `GET /search?q=` — note search (VULNERABLE: SQL injection)
- `POST /notes` — create note (VULNERABLE: no CSRF)
- `POST /login` — authentication (VULNERABLE: no rate limit, plaintext password)

---

## 4. Finding 1 — SQL Injection (Critical)

### 4.1 Description

The `/search` endpoint on the vulnerable app directly concatenates user input into the SQL query:

```javascript
// VULNERABLE CODE (app-vulnerable.js)
const query = `SELECT * FROM notes WHERE title LIKE '%${req.query.q}%'`;
```

This allows an attacker to escape the string context and inject arbitrary SQL.

### 4.2 SQLMap Exploitation

```bash
# Command used:
sqlmap -u "http://localhost:3001/search?q=test" \
  --dbs --tables --dump --level=3 --risk=2 -p q \
  --output-dir=./reports/sqlmap-output
```

**[PASTE SQLMAP OUTPUT HERE — including database names, tables found, and any data extracted]**

**Expected SQLMap findings:**
- Database: `vulnerable.db`
- Tables: `users`, `notes`
- Extracted: usernames and **plaintext passwords** from users table

### 4.3 Proof of Concept (Manual)

```bash
# Boolean-based test — returns different results
curl "http://localhost:3001/search?q=test' OR '1'='1"
curl "http://localhost:3001/search?q=test' OR '1'='2"

# UNION-based extraction (extract user data)
curl "http://localhost:3001/search?q=x' UNION SELECT username,password,id FROM users--"
```

### 4.4 Fix Applied

Replaced string concatenation with parameterized prepared statements in `routes/notes.js`:

```javascript
// SECURE CODE — ? placeholders prevent injection
const notes = db.prepare(
  'SELECT id, title, content FROM notes WHERE user_id = ? AND title LIKE ?'
).all(req.user.userId, `%${req.query.q}%`);
```

**Verification (secure app):**
```bash
sqlmap -u "http://localhost:3000/api/notes/search?q=test" --level=3 -p q \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: "all tested parameters do not appear to be injectable"
```

**[PASTE SQLMAP OUTPUT ON SECURE APP HERE — showing no injection found]**

---

## 5. Finding 2 — Missing CSRF Protection (Critical)

### 5.1 Description

The vulnerable app's `POST /notes` endpoint accepts requests from any origin without validating a CSRF token. An attacker can host a malicious webpage that submits a hidden form to the victim's session.

### 5.2 Burp Suite Testing

**Steps:**
1. Opened Burp Suite Community, set browser proxy to 127.0.0.1:8080
2. Logged into the vulnerable app (port 3001)
3. Intercepted `POST /notes` request
4. Used Burp's "Generate CSRF PoC" function (right-click on request)
5. Hosted the generated HTML on a different port
6. Request succeeded without any token — **CSRF confirmed**

**[PASTE BURP SUITE SCREENSHOT OR REQUEST/RESPONSE HERE]**

### 5.3 Fix Applied

Added `csurf` middleware to all state-changing routes in `routes/notes.js`:

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false }); // session-based

// Client must first GET /api/notes/csrf-token, then include X-CSRF-Token in POST
router.post('/', authenticateJWT, csrfProtection, [...], handler);
```

**Verification:**
```bash
# Without CSRF token — should fail
curl -X POST http://localhost:3000/api/notes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test"}' 
# Expected: 403 {"error":"Invalid or missing CSRF token"}
```

**[PASTE RESPONSE HERE]**

---

## 6. Remediation Summary

| Vulnerability | Root Cause | Fix | File |
|--------------|-----------|-----|------|
| SQL Injection | String concatenation in queries | Parameterized prepared statements | routes/notes.js |
| CSRF | No token validation | csurf middleware | routes/notes.js |
| No Rate Limiting | Missing middleware | express-rate-limit | app.js |
| Plaintext Passwords | No hashing | bcrypt (12 rounds) | routes/auth.js |
| Security Headers | No helmet | helmet + CSP config | app.js |
| Open CORS | Wildcard origin | CORS whitelist | app.js |

---

## 7. Conclusion

All identified vulnerabilities have been patched in the production-ready secure version (`app.js`). The test confirms that the initial implementation was critically vulnerable to data theft via SQL injection and session hijacking via CSRF. Defense-in-depth measures are now in place.
