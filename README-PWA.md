# PWA Setup - Fullscreen App voor Mobiel/Tablet

Deze app is geconfigureerd als Progressive Web App (PWA) en kan fullscreen draaien op telefoon en tablet.

## Features

- ✅ **Standalone mode** - App draait zonder browser UI
- ✅ **Fullscreen** - Geen adresbalk of navigatie
- ✅ **Installable** - Kan worden geïnstalleerd als desktop app
- ✅ **Responsive** - Werkt op alle schermformaten
- ✅ **Offline ready** - Basis offline ondersteuning (via service worker in de toekomst)

## Installeren op Mobiel/Tablet

### iOS (iPhone/iPad)

1. Open de app in Safari
2. Tap op de **Share** knop
3. Selecteer **"Voeg toe aan beginscherm"** of **"Add to Home Screen"**
4. Tap op **"Toevoegen"**
5. De app verschijnt nu als standalone app op je beginscherm
6. Open de app - deze draait nu fullscreen zonder Safari UI

### Android

1. Open de app in Chrome
2. Je ziet automatisch een **"Toevoegen aan beginscherm"** of **"Install app"** prompt
3. Of ga naar het menu (3 stippen) → **"Toevoegen aan beginscherm"** of **"Install app"**
4. Tap op **"Toevoegen"** of **"Install"**
5. De app wordt geïnstalleerd en verschijnt op je beginscherm
6. Open de app - deze draait nu fullscreen zonder browser UI

### Desktop (Chrome/Edge)

1. Open de app in Chrome of Edge
2. Klik op het **install** icoon in de adresbalk (of ga naar menu → "App installeren")
3. Klik op **"Installeren"**
4. De app opent in een standalone venster zonder browser UI

## Iconen Toevoegen

Momenteel gebruikt de app placeholder iconen. Voor productie:

1. **Maak iconen** met de volgende maten:
   - `icon-192x192.png` (192x192 pixels)
   - `icon-512x512.png` (512x512 pixels)

2. **Plaats ze** in de `public/` directory

3. **Aanbevolen tools**:
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
   - Of gebruik een image editor zoals Photoshop/GIMP

4. **Design tips**:
   - Gebruik het TVH logo of een representatief icoon
   - Zorg voor goede contrast
   - Test op verschillende achtergronden
   - Voor iOS: zorg voor padding (maskable icons)

## Manifest Configuratie

De app gebruikt Next.js App Router met een `manifest.ts` bestand dat automatisch `/manifest.webmanifest` genereert.

Belangrijke instellingen:
- `display: 'standalone'` - Geen browser UI
- `orientation: 'any'` - Werkt in landscape en portrait
- `viewport-fit: 'cover'` - Gebruikt volledig scherm (inclusief notch op iPhone X+)

## Browser Ondersteuning

- ✅ Chrome/Edge (Android & Desktop)
- ✅ Safari (iOS & macOS)
- ✅ Firefox (Android & Desktop) - beperkt
- ✅ Samsung Internet (Android)

## Troubleshooting

### App installeert niet

- Controleer of je HTTPS gebruikt (vereist voor PWA)
- Check of `manifest.webmanifest` beschikbaar is op `/manifest.webmanifest`
- Controleer browser console voor errors

### Iconen worden niet getoond

- Zorg dat iconen in `public/` directory staan
- Check of iconen de juiste afmetingen hebben
- Clear browser cache en probeer opnieuw

### App draait niet fullscreen

- Op iOS: check of `apple-mobile-web-app-capable` meta tag aanwezig is
- Check of `display: 'standalone'` in manifest staat
- Clear browser cache en herinstalleer de app

## Service Worker (Toekomstig)

Voor volledige offline functionaliteit kan een service worker worden toegevoegd:

```typescript
// app/service-worker.ts (voorbeeld)
export default function serviceWorker() {
  // Cache strategie
  // Offline fallback
  // Background sync
}
```

## Referenties

- [MDN: Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Next.js: Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [PWA Checklist](https://web.dev/pwa-checklist/)
