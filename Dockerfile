# Week 6 — Docker Security Best Practices
FROM node:20-alpine

# Security: create non-root user — never run as root in production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# npm ci: reproducible installs; --only=production: no dev deps
RUN npm ci --only=production && npm cache clean --force

# Copy source files
COPY . .

# Create runtime directories with correct ownership
RUN mkdir -p data logs && chown -R appuser:appgroup /app

# Security: Drop to non-root user
USER appuser

# Expose only the required port
EXPOSE 3000

# Health check — container restarts if app is unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "app.js"]
