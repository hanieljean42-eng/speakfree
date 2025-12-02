// PWA Installation Manager pour SpeakFree
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.init();
  }

  init() {
    // Enregistrer le Service Worker
    this.registerServiceWorker();

    // Écouter l'événement beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Détecter si l'app est déjà installée
    window.addEventListener('appinstalled', () => {
      console.log('✅ SpeakFree PWA installée avec succès!');
      this.hideInstallButton();
      this.deferredPrompt = null;
    });

    // Créer le bouton d'installation
    this.createInstallButton();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('✅ Service Worker enregistré:', registration.scope);

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              this.showUpdateNotification();
            }
          });
        });
      } catch (error) {
        console.error('❌ Erreur Service Worker:', error);
      }
    }
  }

  createInstallButton() {
    // Créer le conteneur du bouton
    const container = document.createElement('div');
    container.id = 'pwa-install-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: none;
      animation: slideUp 0.3s ease-out;
    `;

    // Créer le bouton
    const button = document.createElement('button');
    button.id = 'pwa-install-button';
    button.innerHTML = `
      <span style="font-size: 1.2em;">📱</span>
      <span>Installer l'Application</span>
    `;
    button.style.cssText = `
      background: linear-gradient(135deg, #e94560, #d63447);
      color: white;
      border: none;
      padding: 15px 25px;
      border-radius: 50px;
      font-size: 1em;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(233, 69, 96, 0.6)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(233, 69, 96, 0.4)';
    });

    button.addEventListener('click', () => this.installApp());

    // Bouton de fermeture
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 25px;
      height: 25px;
      cursor: pointer;
      font-size: 0.9em;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInstallButton();
    });

    container.appendChild(button);
    container.appendChild(closeBtn);
    document.body.appendChild(container);

    this.installButton = container;

    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        #pwa-install-container {
          bottom: 10px;
          right: 10px;
          left: 10px;
        }
        #pwa-install-button {
          width: 100%;
          justify-content: center;
          font-size: 0.95em;
          padding: 12px 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  showInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'block';
    }
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      console.log('❌ Prompt d\'installation non disponible');
      return;
    }

    // Afficher le prompt d'installation
    this.deferredPrompt.prompt();

    // Attendre la réponse de l'utilisateur
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`Installation: ${outcome}`);

    if (outcome === 'accepted') {
      console.log('✅ Utilisateur a accepté l\'installation');
    } else {
      console.log('❌ Utilisateur a refusé l\'installation');
    }

    // Réinitialiser le prompt
    this.deferredPrompt = null;
    this.hideInstallButton();
  }

  showUpdateNotification() {
    // Créer une notification de mise à jour
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(233, 69, 96, 0.95);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 15px;
      animation: slideDown 0.3s ease-out;
    `;

    notification.innerHTML = `
      <span>🔄 Nouvelle version disponible!</span>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #e94560;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        font-weight: bold;
        cursor: pointer;
      ">Actualiser</button>
    `;

    document.body.appendChild(notification);

    // Animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translate(-50%, -100px);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Méthode pour vérifier si l'app est en mode standalone (installée)
  static isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }

  // Méthode pour afficher un badge si l'app est installée
  static showStandaloneBadge() {
    if (PWAInstaller.isStandalone()) {
      console.log('🎉 Application en mode standalone!');
      // Ajouter un badge ou modifier l'UI si nécessaire
    }
  }
}

// Initialiser la PWA au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PWAInstaller();
    PWAInstaller.showStandaloneBadge();
  });
} else {
  new PWAInstaller();
  PWAInstaller.showStandaloneBadge();
}

// Export pour utilisation dans d'autres scripts
window.PWAInstaller = PWAInstaller;
