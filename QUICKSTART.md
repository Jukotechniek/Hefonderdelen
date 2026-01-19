# Quick Start Guide

## Development Mode

1. **Installeer dependencies** (als je dat nog niet hebt gedaan):
   ```bash
   npm install
   ```

2. **Maak `.env.local` bestand** met je environment variabelen:
   ```env
   OPENAI_API_KEY=sk-...
   GOOGLE_AI_API_KEY=...
   NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: http://localhost:3000

## Production Build

1. **Build de app**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

## Docker Deployment

1. **Maak `.env` bestand** (zonder `.local` suffix voor Docker)

2. **Build en run**:
   ```bash
   docker-compose up -d
   ```

3. **App is beschikbaar op**: http://localhost

## Handige Commands

- `npm run dev` - Start development server
- `npm run build` - Build voor productie
- `npm start` - Start production server
- `npm run lint` - Check code voor errors
- `npm run generate-icons` - Genereer PWA iconen

## Troubleshooting

### Port 3000 is al in gebruik
Gebruik een andere poort:
```bash
npm run dev -- -p 3001
```

### Environment variabelen worden niet geladen
- Zorg dat `.env.local` in de root directory staat
- Herstart de development server
- Check of variabele namen correct zijn (NEXT_PUBLIC_* voor client-side)

### App werkt niet
- Check browser console voor errors
- Check terminal output voor build errors
- Zorg dat alle dependencies geïnstalleerd zijn: `npm install`
