# Docker Troubleshooting - 502 Bad Gateway

Als je een 502 Bad Gateway error krijgt, betekent dit dat Nginx niet kan verbinden met Next.js.

## Quick Debugging

### 1. Check container logs

```bash
# Bekijk alle logs
docker logs tvh-uploader

# Of alleen Next.js logs
docker exec tvh-uploader cat /var/log/nextjs.out.log
docker exec tvh-uploader cat /var/log/nextjs.err.log

# Of Nginx logs
docker exec tvh-uploader cat /var/log/nginx/error.log
```

### 2. Check of Next.js draait

```bash
# Check processen in container
docker exec tvh-uploader ps aux

# Je zou moeten zien:
# - node server.js (Next.js)
# - nginx master process
# - supervisord
```

### 3. Test Next.js direct

```bash
# Test Next.js op poort 3000 (intern)
docker exec tvh-uploader wget -qO- http://localhost:3000/api/health

# Test Nginx
docker exec tvh-uploader wget -qO- http://localhost/api/health
```

### 4. Check environment variabelen

```bash
# Check of environment variabelen zijn doorgegeven
docker exec tvh-uploader env | grep -E "OPENAI|SUPABASE|NODE"
```

## Veelvoorkomende problemen

### Problem 1: Next.js start niet

**Oplossing:** Check de logs:
```bash
docker logs tvh-uploader 2>&1 | grep -i error
docker exec tvh-uploader cat /var/log/nextjs.err.log
```

**Mogelijke oorzaken:**
- Environment variabelen ontbreken
- Build fout
- Permissie problemen

### Problem 2: Nginx kan niet verbinden met Next.js

**Oplossing:** Check of Next.js luistert op poort 3000:
```bash
docker exec tvh-uploader netstat -tlnp | grep 3000
```

**Mogelijke oorzaken:**
- Next.js is niet gestart
- Verkeerde poort configuratie
- Firewall blokkeert verbinding

### Problem 3: Supervisor start services niet

**Oplossing:** Check supervisor status:
```bash
docker exec tvh-uploader supervisorctl status
```

**Mogelijke oorzaken:**
- Configuratie fout in supervisor
- Log directory permissions
- Startup timeout

## Fixes

### Environment variabelen toevoegen tijdens runtime

```bash
# Stop container
docker stop tvh-uploader

# Start met environment variabelen
docker run -d \
  -p 3001:80 \
  -e OPENAI_API_KEY=sk-... \
  -e NEXT_PUBLIC_SUPABASE_URL=https://... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --name tvh-uploader \
  --restart unless-stopped \
  tvh-uploader
```

### Restart services in container

```bash
# Restart Next.js
docker exec tvh-uploader supervisorctl restart nextjs

# Restart Nginx
docker exec tvh-uploader supervisorctl restart nginx

# Of restart alle services
docker exec tvh-uploader supervisorctl restart all
```

### Rebuild container

```bash
# Stop en verwijder
docker stop tvh-uploader
docker rm tvh-uploader

# Rebuild
docker-compose build --no-cache

# Start
docker-compose up -d
```

## Cloudflare specifieke issues

### 502 Bad Gateway met Cloudflare

1. **Check Origin Server** (je server):
   ```bash
   curl http://45.9.191.219:3001/api/health
   ```

2. **Cloudflare SSL/TLS settings:**
   - Ga naar Cloudflare Dashboard → SSL/TLS
   - Zet mode op "Full" of "Full (strict)"
   - "Always Use HTTPS" moet OFF zijn tijdens debug

3. **Check Cloudflare DNS:**
   - Zorg dat je A record naar `45.9.191.219` wijst
   - Proxy status moet "Proxied" zijn (oranje wolkje)

4. **Origin Port:**
   - Cloudflare proxiet standaard naar poort 80/443
   - Als je container op poort 3001 draait, moet je of:
     - Container op poort 80 laten draaien (en andere containers verplaatsen)
     - Of Cloudflare Page Rules gebruiken om naar poort 3001 te redirecten

## Alternative: Gebruik alleen Next.js (zonder Nginx)

Als Nginx problemen blijft geven, kun je Next.js direct draaien:

```dockerfile
# Eenvoudigere Dockerfile zonder Nginx
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

En update `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Direct Next.js poort
```
