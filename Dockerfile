# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - Next.js runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Final stage - Nginx with Next.js
FROM nginx:alpine

# Install supervisord to run both services
RUN apk add --no-cache supervisor nodejs npm

# Copy Next.js app from runner stage
COPY --from=runner --chown=root:root /app /app/nextjs

# Install wget for health checks
RUN apk add --no-cache wget

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create logs and run directories
RUN mkdir -p /var/log /var/run && chmod 777 /var/log

# Create startup script for Next.js with environment variables
RUN echo '#!/bin/sh' > /start-nextjs.sh && \
    echo 'cd /app/nextjs' >> /start-nextjs.sh && \
    echo 'export PORT=${PORT:-3000}' >> /start-nextjs.sh && \
    echo 'export HOSTNAME=${HOSTNAME:-0.0.0.0}' >> /start-nextjs.sh && \
    echo 'export NODE_ENV=${NODE_ENV:-production}' >> /start-nextjs.sh && \
    echo 'exec node server.js' >> /start-nextjs.sh && \
    chmod +x /start-nextjs.sh

# Create supervisor configuration directory and file
RUN mkdir -p /etc/supervisor/conf.d && \
    echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'logfile=/var/log/supervisord.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'pidfile=/var/run/supervisord.pid' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'logfile_maxbytes=50MB' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'logfile_backups=10' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nextjs]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=/start-nextjs.sh' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app/nextjs' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'startsecs=10' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'startretries=3' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=200' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/nextjs.err.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/nextjs.out.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=10MB' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=10MB' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'startsecs=5' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=100' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/nginx.err.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/nginx.out.log' >> /etc/supervisor/conf.d/supervisord.conf

# Expose port
EXPOSE 80

# Start supervisor (which will start both Next.js and Nginx)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
