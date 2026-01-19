# Docker Compose Upgrade

Je Docker Compose client versie is te oud (1.38). De minimum versie is 1.44.

## Upgrade Docker Compose

### Op Linux (Server):

```bash
# Check huidige versie
docker-compose --version

# Upgrade Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verifieer nieuwe versie
docker-compose --version
```

### Alternatief: Gebruik Docker Compose V2 (aanbevolen)

Docker Compose V2 is geïntegreerd in Docker:

```bash
# Gebruik `docker compose` (zonder streepje) in plaats van `docker-compose`
docker compose up -d --build
```

### Of gebruik Docker direct zonder docker-compose:

```bash
# Build
docker build -t tvh-uploader .

# Run met environment variabelen uit .env
docker run -d \
  -p 80:80 \
  --env-file .env \
  --name tvh-uploader \
  --restart unless-stopped \
  tvh-uploader
```

## Quick Fix voor nu

Als je snel wilt draaien zonder docker-compose te upgraden:

```bash
# Build de image
docker build -t tvh-uploader .

# Run met docker direct
docker run -d \
  -p 80:80 \
  -e NODE_ENV=production \
  -e OPENAI_API_KEY=${OPENAI_API_KEY} \
  -e NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
  --name tvh-uploader \
  --restart unless-stopped \
  tvh-uploader
```

Vervang `${OPENAI_API_KEY}` etc. met de echte waarden of gebruik `--env-file .env` als je een .env bestand hebt.
