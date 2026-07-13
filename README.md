# SecureNotes API

A REST API built with Node.js/Express and SQLite demonstrating end-to-end web application security across three phases: **Security Hardening (Week 4)**, **Ethical Hacking & Fixes (Week 5)**, and **Security Audits (Week 6)**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4.x |
| Database | SQLite via sql.js (WebAssembly) |
| Auth | JWT (jsonwebtoken) + API Keys |
| Hashing | bcryptjs (rounds: 12) |
| Security Headers | Helmet 7.x |
| Rate Limiting | express-rate-limit 7.x |
| CSRF Protection | csurf 1.11.0 |
| Input Validation | express-validator |
| Logging | Morgan (combined format) |
| Container | Docker (non-root, Alpine) |

---

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/secure-notes-api.git
cd secure-notes-api

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set strong values for JWT_SECRET and SESSION_SECRET

# 4. Start the secure server
npm start
# → http://localhost:3000

# 5. (Week 5 only) Start vulnerable server for testing
npm run start:vulnerable
# → http://localhost:3001
```

---

## Week 4 — Security Hardening

### 1. Security Headers (Helmet)

All responses include protective headers. Verify with:

```bash
curl -I http://localhost:3000/health
```

| Header | Value | Protects Against |
|--------|-------|-----------------|
| Content-Security-Policy | default-src 'self' | XSS, script injection |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | SSL stripping |
| X-Frame-Options | SAMEORIGIN | Clickjacking |
| X-Content-Type-Options | nosniff | MIME sniffing |
| Referrer-Policy | no-referrer | Information leakage |

### 2. Rate Limiting

- **Global**: 100 requests per IP per 15 minutes
- **Auth endpoints**: 5 login attempts per IP per 15 minutes

```bash
# Test rate limiting — run 6 times quickly to trigger 429
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' | python3 -m json.tool
done
```

### 3. CORS Configuration

Only origins listed in `ALLOWED_ORIGINS` (.env) are accepted:

```bash
# Should succeed (same origin)
curl -H "Origin: http://localhost:3000" http://localhost:3000/health

# Should fail with 403 (foreign origin)
curl -H "Origin: http://malicious.com" http://localhost:3000/api/notes
```

### 4. API Authentication

**JWT Flow:**
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"SecurePass1"}'

# Login → get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"SecurePass1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Use token
curl http://localhost:3000/api/notes -H "Authorization: Bearer $TOKEN"
```

**API Key Flow:**
```bash
# After registration, use the returned apiKey
curl http://localhost:3000/api/v1/data -H "X-API-Key: YOUR_API_KEY_HERE"
```

### 5. Fail2Ban Integration

Fail2Ban monitors `logs/access.log` for repeated 401s and bans the IP at the firewall level.

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Copy configs
sudo cp fail2ban/filter.d/secure-notes.conf /etc/fail2ban/filter.d/
sudo cp fail2ban/jail.local /etc/fail2ban/jail.local
# Update logpath in jail.local to your actual path

sudo systemctl restart fail2ban
sudo fail2ban-client status secure-notes-auth
```

---

## Week 5 — Ethical Hacking & Vulnerability Testing

### SQL Injection Testing with SQLMap

```bash
# Step 1: Start the VULNERABLE server
npm run start:vulnerable
# → http://localhost:3001

# Step 2: Run SQLMap against the vulnerable search endpoint
sqlmap -u "http://localhost:3001/search?q=test" \
  --dbs --tables --level=3 --risk=2 -p q \
  --output-dir=./reports/sqlmap-output

# SQLMap WILL find injection points in the vulnerable app.
# Save the output for your Week 5 report.

# Step 3: Run SQLMap against the SECURE app
sqlmap -u "http://localhost:3000/api/notes/search?q=test" \
  --dbs --level=3 --risk=2 -p q \
  -H "Authorization: Bearer YOUR_TOKEN"

# SQLMap should return: "all tested parameters do not appear to be injectable"
```

### CSRF Testing with Burp Suite

1. Open Burp Suite Community, configure browser proxy (127.0.0.1:8080)
2. Log in to the app, intercept a POST /api/notes request
3. **On vulnerable app (port 3001)**: Remove any token headers → request succeeds (CSRF vulnerable)
4. **On secure app (port 3000)**: Remove X-CSRF-Token header → get 403 `Invalid or missing CSRF token`

### Fixes Applied

| Vulnerability | Fix | Code Location |
|--------------|-----|---------------|
| SQL Injection | Prepared statements with `?` placeholders | `routes/notes.js:38` |
| CSRF | csurf middleware + X-CSRF-Token header | `routes/notes.js:12,47` |
| Brute Force | express-rate-limit (5 req/15min) + account lockout | `app.js:59`, `routes/auth.js:55` |
| Plaintext Passwords | bcryptjs with 12 rounds | `routes/auth.js:36` |
| Missing Headers | Helmet with CSP + HSTS | `app.js:31` |

---

## Week 6 — Security Audits

### OWASP ZAP Automated Scan

```bash
# Using ZAP Docker image (easiest)
docker pull zaproxy/zap-stable

# Run baseline scan (passive — no attacks)
docker run -t zaproxy/zap-stable zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -r zap-report.html

# Run full scan (active — includes attack simulation)
docker run -t zaproxy/zap-stable zap-full-scan.py \
  -t http://host.docker.internal:3000 \
  -r zap-full-report.html
```

### Nikto Web Server Scan

```bash
nikto -h http://localhost:3000 -o reports/nikto-report.txt
```

### Lynis System Audit

```bash
# Install
sudo apt install lynis

# Run audit
sudo lynis audit system --report-file reports/lynis-report.txt

# Check score
grep "Hardening index" reports/lynis-report.txt
```

### Docker Container Security

```bash
# Build
docker build -t secure-notes .

# Scan for vulnerabilities with Trivy
docker pull aquasec/trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image secure-notes

# Run container
docker run -d -p 3000:3000 \
  -e JWT_SECRET=your-prod-secret \
  -e SESSION_SECRET=your-prod-session-secret \
  --name secure-notes-app \
  secure-notes
```

### OWASP Top 10 Compliance

| # | Risk | Status | Implementation |
|---|------|--------|---------------|
| A01 | Broken Access Control | ✅ Fixed | JWT auth on all routes; users access only their own data |
| A02 | Cryptographic Failures | ✅ Fixed | bcrypt (12 rounds); HTTPS enforced via HSTS |
| A03 | Injection (SQLi) | ✅ Fixed | Prepared statements throughout |
| A04 | Insecure Design | ✅ Fixed | Rate limiting, account lockout, audit logging |
| A05 | Security Misconfiguration | ✅ Fixed | Helmet headers; CORS whitelist; no verbose errors |
| A06 | Vulnerable Components | ✅ Fixed | npm audit clean; Docker image scanned |
| A07 | Auth & Session Failures | ✅ Fixed | JWT expiry (24h); secure session cookies; lockout |
| A08 | Software Integrity | ✅ Fixed | npm ci for reproducible builds |
| A09 | Logging & Monitoring | ✅ Fixed | Morgan access logs; audit_log table; Fail2Ban |
| A10 | SSRF | ✅ N/A | No server-side URL fetch functionality |

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | None | Register new user |
| POST | /api/auth/login | None | Login, get JWT |
| GET | /api/notes | JWT | List all notes |
| GET | /api/notes/search?q= | JWT | Search notes |
| GET | /api/notes/csrf-token | JWT | Get CSRF token |
| POST | /api/notes | JWT + CSRF | Create note |
| DELETE | /api/notes/:id | JWT + CSRF | Delete note |
| GET | /api/v1/data | API Key | Get user stats |
| GET | /api/v1/notes | API Key | Get notes via API key |
| GET | /health | None | Health check |

---

## Project Structure

```
secure-notes-api/
├── app.js              ← Secure server (all middleware active)
├── app-vulnerable.js   ← Vulnerable server (Week 5 testing ONLY)
├── config/
│   └── database.js     ← SQLite init with security pragmas
├── middleware/
│   └── auth.js         ← JWT + API key validators
├── routes/
│   ├── auth.js         ← Register/login (bcrypt, lockout)
│   ├── notes.js        ← Notes CRUD (CSRF + SQLi prevention)
│   └── api.js          ← API key endpoints
├── public/
│   ├── index.html      ← Demo frontend
│   └── main.js         ← Frontend logic (JWT in memory)
├── fail2ban/           ← Fail2Ban filter + jail config
├── reports/            ← Audit reports (Week 4, 5, 6)
├── Dockerfile          ← Secure container (non-root, Alpine)
└── logs/               ← Morgan access logs (for Fail2Ban)
```
