const fs = require('fs');
const path = require('path');

// Création d'un SVG de base pour SpeakFree
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const createSVG = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e94560;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad${size})" rx="${size * 0.1}"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="rgba(255,255,255,0.1)"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.38}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="${size * 0.02}"/>
  <text x="${size/2}" y="${size/2 + size * 0.05}" font-size="${size * 0.45}" text-anchor="middle" dominant-baseline="middle" fill="white" font-weight="bold" font-family="Arial, sans-serif">SF</text>
</svg>`;
};

const iconsDir = path.join(__dirname, 'public', 'icons');

sizes.forEach(size => {
  const svg = createSVG(size);
  const fileName = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(fileName, svg);
  console.log(`✅ Créé: icon-${size}x${size}.svg`);
});

console.log('\n✨ Toutes les icônes SVG ont été créées avec succès!');
console.log('📂 Emplacement: public/icons/');
console.log('\n💡 Astuce: Pour voir les icônes PNG, ouvrez:');
console.log('   http://localhost:3000/icons/generate-icons.html');
