const fs = require('fs');
const path = require('path');

const PWA_HEAD = `    <!-- PWA Configuration -->
    <link rel="manifest" href="/manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="SpeakFree">
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png">`;

const PWA_SCRIPT = `    <!-- PWA Installer -->
    <script src="/pwa-installer.js" defer></script>`;

const htmlFiles = [
  'about.html',
  'admin.html',
  'chat-ia-coming-soon.html',
  'discussion.html',
  'getting-started.html',
  'guide.html',
  'login.html',
  'maintenance.html',
  'register-school.html',
  'report.html',
  'schools.html',
  'schools-list.html',
  'super-admin.html',
  'terms.html',
  'welcome.html'
];

const publicDir = path.join(__dirname, 'public');

htmlFiles.forEach(fileName => {
  const filePath = path.join(publicDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier ignoré (n'existe pas): ${fileName}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Vérifier si PWA_HEAD n'est pas déjà présent
  if (!content.includes('rel="manifest"')) {
    // Chercher <title> et ajouter PWA_HEAD après
    const titleMatch = content.match(/<title>.*?<\/title>/);
    if (titleMatch) {
      const insertPosition = content.indexOf(titleMatch[0]) + titleMatch[0].length;
      content = content.slice(0, insertPosition) + '\n' + PWA_HEAD + content.slice(insertPosition);
      modified = true;
    }
  }

  // Vérifier si PWA_SCRIPT n'est pas déjà présent
  if (!content.includes('pwa-installer.js')) {
    // Chercher </body> et ajouter PWA_SCRIPT avant
    const bodyCloseMatch = content.match(/<\/body>/);
    if (bodyCloseMatch) {
      const insertPosition = content.indexOf(bodyCloseMatch[0]);
      content = content.slice(0, insertPosition) + PWA_SCRIPT + '\n' + content.slice(insertPosition);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Modifié: ${fileName}`);
  } else {
    console.log(`ℹ️  Déjà configuré: ${fileName}`);
  }
});

console.log('\n🎉 Configuration PWA terminée pour toutes les pages!');
