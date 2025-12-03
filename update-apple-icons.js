const fs = require('fs');
const path = require('path');

const APPLE_TOUCH_ICONS = `    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png">
    <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png">
    <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">`;

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
  'welcome.html',
  'statistics.html',
  'test-pwa.html'
];

const publicDir = path.join(__dirname, 'public');

htmlFiles.forEach(fileName => {
  const filePath = path.join(publicDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Ignoré: ${fileName}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier si les icônes Apple ne sont pas déjà présentes
  if (content.includes('apple-touch-icon-120x120')) {
    console.log(`ℹ️  Déjà configuré: ${fileName}`);
    return;
  }

  // Chercher la ligne avec apple-touch-icon existante
  const appleIconMatch = content.match(/<link rel="apple-touch-icon"[^>]*>/);
  
  if (appleIconMatch) {
    // Remplacer l'icône existante par toutes les tailles
    content = content.replace(appleIconMatch[0], APPLE_TOUCH_ICONS);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Modifié: ${fileName}`);
  } else {
    console.log(`⚠️  Pas d'icône Apple trouvée: ${fileName}`);
  }
});

console.log('\n🎉 Configuration des icônes Apple terminée!');
