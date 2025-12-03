const fs = require('fs');
const path = require('path');

// Créer des icônes Apple Touch Icon de différentes tailles
const appleSizes = [
  { size: 180, name: 'apple-touch-icon.png' },           // iPhone Retina
  { size: 167, name: 'apple-touch-icon-167x167.png' },   // iPad Pro
  { size: 152, name: 'apple-touch-icon-152x152.png' },   // iPad Retina
  { size: 120, name: 'apple-touch-icon-120x120.png' }    // iPhone
];

const createAppleSVG = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="appleGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e94560;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#appleGrad${size})"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="rgba(255,255,255,0.1)"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.38}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="${size * 0.02}"/>
  <text x="${size/2}" y="${size/2 + size * 0.05}" font-size="${size * 0.4}" text-anchor="middle" dominant-baseline="middle" fill="white" font-weight="bold" font-family="Arial, sans-serif">SF</text>
</svg>`;
};

const iconsDir = path.join(__dirname, 'public', 'icons');

appleSizes.forEach(({ size, name }) => {
  const svg = createAppleSVG(size);
  const fileName = path.join(iconsDir, name);
  fs.writeFileSync(fileName, svg);
  console.log(`✅ Créé: ${name}`);
});

console.log('\n✨ Icônes Apple Touch créées avec succès!');
