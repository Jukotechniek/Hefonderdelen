// Minimal script: converteer bestaande SVG-iconen in /public naar PNG voor de PWA
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  try {
    await sharp(path.join(publicDir, 'icon-192x192.svg'))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));

    await sharp(path.join(publicDir, 'icon-512x512.svg'))
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));

    console.log('✅ PNG-iconen succesvol gegenereerd uit bestaande SVG\'s.');
  } catch (error) {
    console.error('❌ Fout bij genereren van iconen:', error.message);
    process.exit(1);
  }
}

generateIcons();
