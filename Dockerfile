# --- Builder stage ---
    FROM node:20-bullseye-slim AS builder

    WORKDIR /app
    
    # 1. Dependencies installeren
    COPY package*.json ./
    RUN npm ci
    
    # 2. Broncode kopiëren en builden
    COPY . .
    RUN npm run build
    
    # --- Runtime stage ---
    FROM node:20-bullseye-slim AS runner
    
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME=0.0.0.0
    
    # Python + pip installeren
    RUN apt-get update && \
        apt-get install -y --no-install-recommends python3 python3-pip && \
        rm -rf /var/lib/apt/lists/*
    
    # Python libs voor scripts/remove_bg.py
    RUN pip3 install --no-cache-dir transparent-background pillow
    
    # Zorgen dat je Node-code 'python3' gebruikt
    ENV PYTHON=python3
    
    # Niet als root draaien (kan je behouden)
    RUN addgroup --system --gid 1001 nodejs \
     && adduser --system --uid 1001 nextjs
    
    # Alleen benodigde bestanden uit de build kopiëren
    COPY --from=builder /app/public ./public
    COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
    COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
    
    USER nextjs
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]