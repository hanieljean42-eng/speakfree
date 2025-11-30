// Configuration du mode maintenance
// Changez cette valeur à true pour activer le mode maintenance
const MAINTENANCE_MODE = false;

// Pages exclues de la redirection (ex: page de maintenance elle-même)
const EXCLUDED_PAGES = [
    '/maintenance.html',
    '/maintenance-config.js'
];

// Fonction pour vérifier si on doit rediriger vers la page de maintenance
function checkMaintenanceMode() {
    const currentPath = window.location.pathname;
    
    // Ne pas rediriger si on est déjà sur une page exclue
    if (EXCLUDED_PAGES.some(page => currentPath.includes(page))) {
        return;
    }
    
    // Rediriger vers la page de maintenance si le mode est activé
    if (MAINTENANCE_MODE) {
        window.location.href = '/maintenance.html';
    }
}

// Exécuter la vérification au chargement de la page
checkMaintenanceMode();
