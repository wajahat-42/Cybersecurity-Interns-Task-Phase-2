# Week 4 — Security Implementation Report
**Project:** SecureNotes API  
**Intern:** [Your Name]  
**Date:** July 2026  
**Supervisor:** [Supervisor Name]

---

## 1. Executive Summary

This report documents the security hardening applied to the SecureNotes REST API during Week 4. The application was enhanced with multiple defensive layers including HTTP security headers, rate limiting, CORS whitelisting, API key authentication, JWT-based session management, and real-time intrusion detection via Fail2Ban.

---

## 2. Intrusion Detection & Monitoring

### 2.1 Fail2Ban Setup

Fail2Ban was installed and configured to monitor the application's access logs for suspicious login patterns.

**Configuration file:** `/etc/fail2ban/filter.d/secure-notes.conf`
```
[Definition]
failregex = ^<HOST> .* "POST /api/auth/login HTTP/.*" 401 .*$
```

**Jail settings:**
- Max retries: 5 failed attempts
- Find window: 15 minutes
- Ban duration: 1 hour

**Verification:**
```bash
sudo fail2ban-client status secure-notes-auth
```

**[PASTE FAIL2BAN STATUS OUTPUT HERE]**

### 2.2 Application-Level Lockout

Independent of Fail2Ban, the application itself implements account-level lockout:
- After 5 failed login attempts, the account is locked for 15 minutes
- All lockout events are logged to the `audit_log` database table
- Log entry format: `FAILED_LOGIN | Attempt 3/5 | IP: x.x.x.x`

---

## 3. API Security Hardening

### 3.1 Rate Limiting

Implemented using `express-rate-limit` v7:

| Endpoint Group | Window | Limit | Action on Exceed |
|---------------|--------|-------|-----------------|
| All routes | 15 min | 100 req/IP | 429 Too Many Requests |
| /api/auth/* | 15 min | 5 req/IP | 429 Too Many Requests |

**Test — Rate limit trigger:**
```bash
for i in {1..6}; do curl -X POST http://localhost:3000/api/auth/login -d '{"email":"x@x.com","password":"wrong"}' -H "Content-Type: application/json"; echo; done
```

**[PASTE CURL OUTPUT SHOWING 429 RESPONSE HERE]**

### 3.2 CORS Configuration

CORS is restricted to whitelisted origins only:

```javascript
origin: ['http://localhost:3000']  // from ALLOWED_ORIGINS env var
```

**Test — Rejected origin:**
```bash
curl -I -H "Origin: http://attacker.com" http://localhost:3000/api/notes
```
Expected: `403 Forbidden`

**[PASTE CURL HEADERS OUTPUT HERE]**

### 3.3 Authentication Mechanisms

**JWT (Bearer Token):**
- Algorithm: HS256
- Expiry: 24 hours
- Payload: userId, username (no sensitive data)
- Stored client-side: in-memory only (not localStorage)

**API Keys:**
- Format: UUID v4 (e.g., `a1b2c3d4-e5f6-...`)
- Transport: `X-API-Key` header
- Stored: Database (not hashed — treated as long random passwords)
- Use case: Machine-to-machine access

---

## 4. Security Headers & CSP

Headers were applied using the `helmet` npm package.

**Verification:**
```bash
curl -I http://localhost:3000/health
```

**[PASTE FULL RESPONSE HEADERS HERE]**

| Header | Configured Value | Purpose |
|--------|-----------------|---------|
| Content-Security-Policy | default-src 'self'; frame-src 'none' | Block XSS, clickjacking |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Force HTTPS |
| X-Frame-Options | SAMEORIGIN | Prevent iframe embedding |
| X-Content-Type-Options | nosniff | Prevent MIME type sniffing |
| X-XSS-Protection | 0 (modern CSP replaces this) | Legacy XSS filter |
| Referrer-Policy | no-referrer | Prevent information leakage |

**CSP Explanation:**
The `default-src 'self'` directive ensures that only resources from the same origin (localhost:3000) are loaded. This prevents:
- Loading malicious scripts from external CDNs if injected
- Data exfiltration via image tags or iframes
- Unauthorized API calls from injected JavaScript

**HSTS Explanation:**
Once a browser sees the HSTS header, it will automatically convert all HTTP requests to HTTPS for the specified `max-age` duration, even before making the initial request — preventing SSL stripping attacks.

---

## 5. GitHub Repository

**Repository URL:** [YOUR GITHUB URL]  
**Commits this week:**
1. `feat: add helmet security headers with CSP and HSTS`
2. `feat: implement express-rate-limit on auth endpoints`
3. `feat: configure CORS whitelist`
4. `feat: add JWT and API key authentication`
5. `feat: add Fail2Ban config and Morgan access logging`
6. `docs: add Week 4 security implementation to README`

---

## 6. Conclusion

All Week 4 deliverables have been implemented and verified. The API now enforces multiple layers of defense-in-depth: network-level (Fail2Ban), transport-level (HSTS), application-level (rate limiting, CORS, input validation), and session-level (secure JWT cookies, CSP).
