# 🔧 Système de Mode Maintenance

## Comment activer le mode maintenance ?

### Méthode simple (recommandée) :

1. Ouvrez le fichier `public/maintenance-config.js`
2. Changez la ligne :
   ```javascript
   const MAINTENANCE_MODE = false;
   ```
   en :
   ```javascript
   const MAINTENANCE_MODE = true;
   ```
3. Enregistrez et déployez le fichier
4. Tous les visiteurs seront automatiquement redirigés vers la page de maintenance

### Pour désactiver le mode maintenance :

1. Ouvrez `public/maintenance-config.js`
2. Remettez :
   ```javascript
   const MAINTENANCE_MODE = false;
   ```
3. Enregistrez et déployez

## Que voit l'utilisateur ?

Une magnifique page de maintenance avec :
- 🎨 Design moderne et attrayant avec animations
- ⚙️ Icône de maintenance animée
- 💬 Message personnalisé : "Nous améliorons SpeakFree pour vous offrir une meilleure expérience !"
- 🔄 Rafraîchissement automatique toutes les 30 secondes
- 📱 Design responsive (mobile et desktop)

## Intégration automatique

Le script `maintenance-config.js` doit être inclus dans toutes vos pages HTML principales :

```html
<head>
    ...
    <script src="/maintenance-config.js"></script>
</head>
```

Pages à mettre à jour :
- ✅ index.html
- ✅ welcome.html
- ✅ login.html
- ✅ register-school.html
- ✅ schools.html
- ✅ admin.html
- ✅ discussion.html
- ✅ chat-ia.html
- ✅ report.html
- Et toutes les autres pages publiques

## Personnalisation

Vous pouvez personnaliser la page de maintenance en modifiant `public/maintenance.html` :
- Changer les couleurs
- Modifier le message
- Ajouter vos liens sociaux
- Ajuster le temps de rafraîchissement automatique
