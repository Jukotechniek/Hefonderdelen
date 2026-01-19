// Script om SVG iconen te converteren naar PNG voor PWA
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// SVG template voor heftruck icoon (192x192)
const svg192 = `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#2563eb" rx="24"/>
  
  <!-- Heftruck body -->
  <rect x="36" y="80" width="80" height="60" rx="4" fill="#ffffff"/>
  <rect x="40" y="84" width="72" height="52" rx="2" fill="#f1f5f9"/>
  
  <!-- Cab window -->
  <rect x="48" y="92" width="28" height="20" rx="2" fill="#e2e8f0"/>
  <line x1="62" y1="92" x2="62" y2="112" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="48" y1="102" x2="76" y2="102" stroke="#cbd5e1" stroke-width="1.5"/>
  
  <!-- Mast -->
  <rect x="68" y="56" width="16" height="24" fill="#ffffff"/>
  <line x1="76" y1="56" x2="76" y2="80" stroke="#cbd5e1" stroke-width="1.5"/>
  
  <!-- Forks -->
  <rect x="56" y="56" width="6" height="20" rx="1" fill="#ffffff"/>
  <rect x="90" y="56" width="6" height="20" rx="1" fill="#ffffff"/>
  <line x1="59" y1="56" x2="59" y2="76" stroke="#cbd5e1" stroke-width="1"/>
  <line x1="93" y1="56" x2="93" y2="76" stroke="#cbd5e1" stroke-width="1"/>
  
  <!-- Wheels -->
  <circle cx="50" cy="148" r="12" fill="#1e293b"/>
  <circle cx="50" cy="148" r="8" fill="#475569"/>
  <circle cx="102" cy="148" r="12" fill="#1e293b"/>
  <circle cx="102" cy="148" r="8" fill="#475569"/>
  
  <!-- Counterweight -->
  <rect x="116" y="100" width="28" height="40" rx="2" fill="#ffffff"/>
  <rect x="120" y="104" width="20" height="32" rx="1" fill="#e2e8f0"/>
  
  <!-- TVH text -->
  <text x="96" y="168" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">TVH</text>
</svg>`;

// SVG template voor heftruck icoon (512x512)
const svg512 = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb" rx="64"/>
  
  <!-- Heftruck body -->
  <rect x="96" y="212" width="214" height="160" rx="12" fill="#ffffff"/>
  <rect x="104" y="220" width="198" height="144" rx="6" fill="#f1f5f9"/>
  
  <!-- Cab window -->
  <rect x="128" y="244" width="74" height="54" rx="6" fill="#e2e8f0"/>
  <line x1="165" y1="244" x2="165" y2="298" stroke="#cbd5e1" stroke-width="3"/>
  <line x1="128" y1="271" x2="202" y2="271" stroke="#cbd5e1" stroke-width="3"/>
  
  <!-- Mast -->
  <rect x="180" y="148" width="44" height="64" fill="#ffffff"/>
  <line x1="202" y1="148" x2="202" y2="212" stroke="#cbd5e1" stroke-width="3"/>
  
  <!-- Forks -->
  <rect x="148" y="148" width="16" height="52" rx="2" fill="#ffffff"/>
  <rect x="240" y="148" width="16" height="52" rx="2" fill="#ffffff"/>
  <line x1="156" y1="148" x2="156" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <line x1="248" y1="148" x2="248" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  
  <!-- Wheels -->
  <circle cx="134" cy="392" r="32" fill="#1e293b"/>
  <circle cx="134" cy="392" r="22" fill="#475569"/>
  <circle cx="272" cy="392" r="32" fill="#1e293b"/>
  <circle cx="272" cy="392" r="22" fill="#475569"/>
  
  <!-- Counterweight -->
  <rect x="310" y="266" width="76" height="106" rx="6" fill="#ffffff"/>
  <rect x="320" y="276" width="56" height="86" rx="3" fill="#e2e8f0"/>
  
  <!-- TVH text -->
  <text x="256" y="460" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle">TVH</text>
</svg>`;

// Maak public directory als deze niet bestaat
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function generateIcons() {
  try {
    // Schrijf SVG bestanden
    fs.writeFileSync(path.join(publicDir, 'icon-192x192.svg'), svg192);
    fs.writeFileSync(path.join(publicDir, 'icon-512x512.svg'), svg512);
    
    // Converteer naar PNG met Sharp
    const buffer192 = Buffer.from(svg192);
    const buffer512 = Buffer.from(svg512);
    
    await sharp(buffer192)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    
    await sharp(buffer512)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    
    console.log('✅ Iconen succesvol gegenereerd!');
    console.log('');
    console.log('📁 Bestanden aangemaakt in public/:');
    console.log('   - icon-192x192.svg');
    console.log('   - icon-192x192.png');
    console.log('   - icon-512x512.svg');
    console.log('   - icon-512x512.png');
    console.log('');
    console.log('🎉 PWA iconen zijn klaar voor gebruik!');
  } catch (error) {
    console.error('❌ Fout bij genereren van iconen:', error.message);
    console.log('');
    console.log('💡 Tip: Zorg dat sharp is geïnstalleerd:');
    console.log('   npm install --save-dev sharp');
    process.exit(1);
  }
}

generateIcons();
