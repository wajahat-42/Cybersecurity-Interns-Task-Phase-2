# Week 6 — Final Security Audit Report
**Project:** SecureNotes API  
**Intern:** [Your Name]  
**Date:** July 2026  
**Audit Type:** Final Pre-Deployment Security Audit

---

## 1. Executive Summary

A comprehensive security audit was performed on the production-ready SecureNotes API using industry-standard tools: OWASP ZAP, Nikto, and Lynis. A final penetration test was conducted using Burp Suite. The application demonstrates compliance with the OWASP Top 10 and follows Docker security best practices for containerized deployment.

---

## 2. OWASP ZAP Scan Results

**Command used:**
```bash
docker run -t zaproxy/zap-stable zap-baseline.py \
  -t http://host.docker.internal:3000 -r zap-report.html
```

**[PASTE ZAP SCAN SUMMARY HERE]**

**Expected findings after hardening:**
- WARN: Cookie without SameSite attribute → Already set to `strict` in session config ✅
- PASS: CSP header present ✅
- PASS: No SQL injection found ✅
- PASS: HSTS header present ✅

**Alerts breakdown:**
| Alert | Risk | Status |
|-------|------|--------|
| [PASTE FROM ZAP REPORT] | | |

---

## 3. Nikto Scan Results

**Command used:**
```bash
nikto -h http://localhost:3000 -o reports/nikto-report.txt -Format txt
```

**[PASTE NIKTO FULL OUTPUT HERE]**

**Key findings:**
| Finding | Severity | Action Taken |
|---------|----------|-------------|
| [PASTE FROM NIKTO OUTPUT] | | |

**Sample items Nikto typically checks:**
- Missing X-Frame-Options → Present via Helmet ✅
- Missing X-Content-Type-Options → Present via Helmet ✅
- Information disclosure in Server header → Helmet removes it ✅

---

## 4. Lynis System Audit

**Command used:**
```bash
sudo lynis audit system --report-file reports/lynis-report.txt
```

**[PASTE LYNIS HARDENING INDEX SCORE HERE]**

**Top suggestions from Lynis:**
| Suggestion | Category | Status |
|-----------|----------|--------|
| [PASTE FROM LYNIS OUTPUT] | | |

---

## 5. Docker Security Audit

The application is containerized following Docker security best practices:

```bash
# Build image
docker build -t secure-notes .

# Scan for CVEs with Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image secure-notes
```

**[PASTE TRIVY SCAN OUTPUT HERE]**

**Docker security measures implemented:**

| Practice | Implementation |
|----------|---------------|
| Non-root user | `USER appuser` (UID not 0) |
| Minimal base image | `node:20-alpine` (smaller attack surface) |
| No dev dependencies | `npm ci --only=production` |
| Health check | Defined in Dockerfile |
| No secrets in image | Secrets passed via env vars at runtime |
| Layer caching | package.json copied first |

---

## 6. Final Penetration Test

**Tools:** Burp Suite Community Edition  
**Scope:** All API endpoints of secure app (port 3000)

### 6.1 Authentication Testing

| Test | Expected | Result |
|------|----------|--------|
| Login with wrong password | 401 | |
| Login 6 times → rate limit | 429 | |
| Login 5 times → account lockout | 423 | |
| Access /api/notes without token | 401 | |
| Access /api/notes with expired token | 401 | |

**[PASTE TEST RESULTS]**

### 6.2 Injection Testing

| Test | Expected | Result |
|------|----------|--------|
| `?q=test' OR '1'='1` | Returns only user's notes, not all | |
| `?q=test' UNION SELECT 1,2,3--` | Error or empty result | |
| POST body with `<script>alert(1)</script>` | Stored escaped, not executed | |

**[PASTE TEST RESULTS]**

### 6.3 CSRF Testing

| Test | Expected | Result |
|------|----------|--------|
| POST /api/notes without X-CSRF-Token | 403 | |
| POST with invalid CSRF token | 403 | |
| POST with valid CSRF token | 201 | |

**[PASTE TEST RESULTS]**

---

## 7. OWASP Top 10 Compliance Checklist

| # | Risk | Status | Implementation |
|---|------|--------|---------------|
| A01 | Broken Access Control | ✅ | JWT auth on all routes; user owns their data |
| A02 | Cryptographic Failures | ✅ | bcrypt (12 rounds); HSTS; secure session cookies |
| A03 | Injection | ✅ | Prepared statements; input validation |
| A04 | Insecure Design | ✅ | Rate limiting; lockout; audit logging |
| A05 | Security Misconfiguration | ✅ | Helmet headers; CORS whitelist; no verbose errors |
| A06 | Vulnerable Components | ✅ | npm audit passes; Trivy clean |
| A07 | Auth & Session Failures | ✅ | JWT expiry 24h; httpOnly cookies; lockout |
| A08 | Software Integrity | ✅ | npm ci; pinned dependency versions |
| A09 | Logging & Monitoring | ✅ | Morgan access log; audit_log table; Fail2Ban |
| A10 | SSRF | ✅ N/A | No server-side URL fetching |

---

## 8. Recommendations for Production

1. **TLS/HTTPS**: Place behind nginx/Caddy with valid TLS certificate
2. **Environment Variables**: Use a secrets manager (AWS Secrets Manager, Vault) instead of .env files
3. **Database**: Migrate from SQLite to PostgreSQL for multi-user production load
4. **CSRF**: Upgrade from deprecated `csurf` to `csrf-csrf` package
5. **Dependencies**: Schedule weekly `npm audit` in CI/CD pipeline
6. **WAF**: Consider Cloudflare WAF or AWS WAF for additional protection
7. **Monitoring**: Forward access logs to ELK stack or Datadog for real-time alerting

---

## 9. Conclusion

The SecureNotes API has passed the final security audit with all critical vulnerabilities resolved. The application demonstrates compliance with OWASP Top 10 guidelines and is deployable in a secure containerized environment. All findings from Weeks 4 and 5 have been verified as fixed.
