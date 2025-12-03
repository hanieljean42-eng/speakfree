const fs = require('fs');
const path = require('path');

// Tailles de splash screens pour iOS
const splashSizes = [
  // iPhone
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png', device: 'iPhone X/XS/11 Pro' },
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png', device: 'iPhone XS Max/11 Pro Max' },
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png', device: 'iPhone XR/11' },
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png', device: 'iPhone 12/13/14' },
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778.png', device: 'iPhone 12/13/14 Pro Max' },
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png', device: 'iPhone 6/7/8' },
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208.png', device: 'iPhone 6+/7+/8+' },
  // iPad
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png', device: 'iPad Mini/Air' },
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png', device: 'iPad Pro 12.9"' }
];

const createSplashSVG = (width, height) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const logoSize = Math.min(width, height) * 0.3;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="logo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e94560;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  
  <!-- Logo Circle -->
  <circle cx="${centerX}" cy="${centerY}" r="${logoSize * 0.6}" fill="rgba(255,255,255,0.05)"/>
  <circle cx="${centerX}" cy="${centerY}" r="${logoSize * 0.58}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${logoSize * 0.02}"/>
  
  <!-- Logo Text -->
  <text x="${centerX}" y="${centerY + logoSize * 0.08}" 
        font-size="${logoSize * 0.5}" 
        font-weight="bold" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        fill="url(#logo)" 
        font-family="Arial, sans-serif">SF</text>
  
  <!-- App Name -->
  <text x="${centerX}" y="${centerY + logoSize * 1.2}" 
        font-size="${logoSize * 0.15}" 
        font-weight="bold" 
        text-anchor="middle" 
        fill="white" 
        font-family="Arial, sans-serif">SpeakFree</text>
  
  <!-- Tagline -->
  <text x="${centerX}" y="${centerY + logoSize * 1.5}" 
        font-size="${logoSize * 0.1}" 
        text-anchor="middle" 
        fill="rgba(255,255,255,0.6)" 
        font-family="Arial, sans-serif">Parle librement. Protège ton école.</text>
</svg>`;
};

const iconsDir = path.join(__dirname, 'public', 'icons');

console.log('🎨 Génération des splash screens iOS...\n');

splashSizes.forEach(({ width, height, name, device }) => {
  const svg = createSplashSVG(width, height);
  const fileName = path.join(iconsDir, name);
  fs.writeFileSync(fileName, svg);
  console.log(`✅ ${name} (${device})`);
});

console.log('\n✨ Tous les splash screens ont été créés!');
console.log('📂 Emplacement: public/icons/');
