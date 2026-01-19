# Docker Deployment met Next.js en Nginx

Deze app gebruikt Next.js als backend met Nginx als reverse proxy voor productie deployment.

## Architectuur

- **Next.js** draait op poort 3000 (intern)
- **Nginx** draait op poort 80 (extern) en proxyt alle requests naar Next.js
- Alle statische assets worden door Nginx gecached
- API routes worden direct doorgegeven aan Next.js

## Build en Run

### 1. Maak een `.env` bestand

Kopieer `.env.example` naar `.env` en vul de juiste waarden in:

```env
# Server-side API Keys (veilig, niet geëxposeerd aan browser)
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Client-side environment variables
NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 2. Build de Docker image

```bash
docker build -t tvh-uploader .
```

### 3. Run de container

```bash
docker run -d \
  -p 80:80 \
  --env-file .env \
  --name tvh-uploader \
  tvh-uploader
```

De app is nu beschikbaar op http://localhost

## Docker Compose (Aanbevolen)

### 1. Maak een `.env` bestand

Zie stap 1 hierboven.

### 2. Start met docker-compose

```bash
docker-compose up -d
```

### 3. Bekijk logs

```bash
docker-compose logs -f
```

### 4. Stop de container

```bash
docker-compose down
```

## Verificatie

Controleer of alles werkt:

```bash
# Health check
curl http://localhost/api/health

# Bekijk logs
docker logs tvh-uploader

# Of met docker-compose
docker-compose logs -f
```

## Troubleshooting

### Container start niet

```bash
# Bekijk logs
docker logs tvh-uploader

# Check of Next.js draait
docker exec tvh-uploader ps aux | grep node

# Check of Nginx draait
docker exec tvh-uploader ps aux | grep nginx
```

### Port 80 is al in gebruik

Wijzig de poort mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Nu beschikbaar op http://localhost:8080
```

### Environment variabelen worden niet geladen

Zorg dat je `.env` bestand in de root directory staat en dat je `--env-file .env` gebruikt bij `docker run` of dat de variabelen in `docker-compose.yml` zijn gedefinieerd.

## Productie Deployment

Voor productie overweeg:

1. **HTTPS/SSL**: Configureer SSL certificaten in Nginx
2. **Reverse Proxy**: Gebruik een externe reverse proxy (zoals Traefik of Cloudflare)
3. **Monitoring**: Voeg monitoring toe (zoals Prometheus/Grafana)
4. **Logging**: Configureer log aggregation (zoals ELK stack)
5. **Backup**: Zet een backup strategie op voor Supabase data

### SSL/HTTPS Setup

Voor HTTPS in productie, update `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name jouw-domein.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # ... rest van configuratie
}
```
