#!/bin/sh
set -e

# Export environment variables
export PORT=${PORT:-3000}
export HOSTNAME=${HOSTNAME:-0.0.0.0}
export NODE_ENV=${NODE_ENV:-production}

# Wait for Next.js to be ready (health check)
wait_for_nextjs() {
  echo "Waiting for Next.js to start..."
  for i in $(seq 1 30); do
    if wget -q --spider http://localhost:3000/api/health 2>/dev/null; then
      echo "Next.js is ready!"
      return 0
    fi
    echo "Attempt $i/30: Next.js not ready yet..."
    sleep 2
  done
  echo "Next.js failed to start in time"
  return 1
}

# Start Next.js in background
echo "Starting Next.js..."
cd /app/nextjs
node server.js &
NEXTJS_PID=$!

# Wait for Next.js to be ready
if wait_for_nextjs; then
  echo "Starting Nginx..."
  exec nginx -g "daemon off;"
else
  echo "Failed to start Next.js, exiting..."
  kill $NEXTJS_PID 2>/dev/null || true
  exit 1
fi
