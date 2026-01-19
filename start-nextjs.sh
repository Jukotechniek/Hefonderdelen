#!/bin/sh
cd /app/nextjs

# Set default environment variables
export PORT=${PORT:-3000}
export HOSTNAME=${HOSTNAME:-0.0.0.0}
export NODE_ENV=${NODE_ENV:-production}

# Start Next.js
exec node server.js
