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

# Python + pip voor scripts/remove_bg.py (rembg, geen PyTorch)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Python libs: onnxruntime eerst (rembg-afhankelijkheid), dan rembg, pillow, numpy
# python3 -m pip = zelfde interpreter als bij runtime
RUN python3 -m pip install --no-cache-dir \
    onnxruntime \
    rembg \
    pillow \
    numpy \
    && python3 -c "import onnxruntime; import rembg; print('ok')"

# Zorgen dat je Node-code 'python3' gebruikt
ENV PYTHON=python3

# Niet als root draaien (kan je behouden)
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Alleen benodigde bestanden uit de build kopiëren
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]