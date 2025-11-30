# 💬 SpeakFree - Plateforme de Signalement Sécurisée

## 📋 Vue d'ensemble

**SpeakFree** est une plateforme web sécurisée permettant aux étudiants de signaler anonymement les incidents dans leur établissement scolaire. La plateforme offre un assistant IA (Haniel) pour guider les utilisateurs dans le processus de signalement.

---

## 🌐 Déploiement

### Architecture Production
- **Frontend** : Netlify (fichiers statiques dans `/public/`)
- **Backend** : Render (serveur Node.js)
- **Base de données** : MySQL (PlanetScale, Railway, ou autre)

### Configuration de Déploiement

#### Frontend sur Netlify
1. Connectez votre repo GitHub à Netlify
2. Le fichier `netlify.toml` configure automatiquement le build
3. Mettez à jour l'URL backend dans `public/config.js`

#### Backend sur Render
1. Connectez votre repo GitHub à Render
2. Le fichier `render.yaml` configure automatiquement le service
3. Ajoutez les variables d'environnement dans le dashboard Render :
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   - `JWT_SECRET`, `SUPER_ADMIN_CODE`
   - `MYSQL_SSL=true` (pour les connexions sécurisées)

---

## 🚀 Démarrage Rapide (Local)

### Prérequis
- Node.js v22.21.0
- npm

### Installation

1. **Naviguez dans le répertoire du projet**
   ```bash
   cd "e:\ECOLE V 5"
   ```

2. **Installez les dépendances** (déjà fait)
   ```bash
   npm install
   ```

3. **Remplissez la base de données avec des données de démonstration**
   ```bash
   node seed-data.js
   ```

4. **Démarrez le serveur**
   ```bash
   npm start
   # ou
   node server.js
   ```

### 🌐 Accès au site

- **URL principale** : http://localhost:3000
- **Port** : 3000 (configurable dans `.env`)

---

## 📊 Statistiques en Temps Réel

### Pages de Statistiques

- **📊 Tableau de bord statistiques** : http://localhost:3000/statistics
- **🏫 Liste des écoles** : http://localhost:3000/schools-list
- **🧪 Test de l'API** : http://localhost:3000/test-api.html

### Données de Démonstration

Le script `seed-data.js` ajoute automatiquement :

#### Écoles (5)
1. **Lycée Henri Wallon** (LYC001) - Aubervilliers - 1200 élèves
2. **Collège Jules Michelet** (COL002) - Bagnolet - 850 élèves
3. **Lycée Technique Marchal Ney** (LYC003) - Saint-Denis - 950 élèves
4. **Collège Rosa Luxemburg** (COL004) - La Courneuve - 720 élèves
5. **Lycée Professionnel Louis Armand** (LYC005) - Villepinte - 600 élèves

#### Administrateurs (5)

| Email | Mot de passe | Établissement |
|-------|-------------|---------------|
| admin1@lyceewallon.edu | Admin@123456 | Lycée Henri Wallon |
| admin2@collegejules.edu | Admin@123456 | Collège Jules Michelet |
| admin3@lyceemarchal.edu | Admin@123456 | Lycée Technique Marchal Ney |
| admin4@collegerosa.edu | Admin@123456 | Collège Rosa Luxemburg |
| admin5@lyceeprofessionnel.edu | Admin@123456 | Lycée Professionnel Louis Armand |

#### Signalements (7)
- 🔴 **En attente** : 3
- 🟡 **En cours** : 2
- 🟢 **Résolus** : 2

Types d'incidents : Harcèlement, Violence, Vol, Cyber-Harcèlement, Dégradation de biens, Incivilités, Discrimination

---

## 🗺️ Plan du Site

### Pages Publiques
- **/** - Accueil avec statistiques en temps réel
- **/statistics** - Dashboard complet avec graphiques
- **/schools-list** - Liste des écoles partenaires
- **/guide** - Guide d'utilisation
- **/about** - À propos de SpeakFree
- **/terms** - Conditions d'utilisation

### Pages de Signalement
- **/chat-ia** - Discuter avec Haniel (Assistant IA)
- **/reprendre-haniel** - Reprendre une conversation précédente
- **/report** - Formulaire de signalement manuel
- **/discussion** - Accéder à une discussion existante

### Espace Administrateur
- **/login** - Connexion administrateur
- **/admin** - Tableau de bord administrateur
- **/register-school** - Inscription d'une nouvelle école
- **/super-admin** - Interface Super Admin

---

## 🔌 API REST

### Endpoints Principaux

#### Santé du Serveur
```
GET /api/health
Réponse : { status: "ok", message: "...", timestamp: "..." }
```

#### Statistiques Globales
```
GET /api/schools/stats/global
Réponse : { schools: 5, reports: 7, admins: 5 }
```

#### Lister les Écoles
```
GET /api/schools
Réponse : { schools: [...] }
```

#### Authentification Admin
```
POST /api/auth/login
Body : { email: "...", password: "..." }
```

#### Signalements
```
GET /api/reports - Lister les signalements
POST /api/reports - Créer un signalement
GET /api/reports/:id - Détails d'un signalement
```

#### Chat IA
```
POST /api/ai-chat/start - Démarrer une session
POST /api/ai-chat/message - Envoyer un message
GET /api/ai-chat/session/:code - Récupérer une session
```

---

## 🔐 Configuration Sécurité

Fichier `.env` :
```
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DATABASE_PATH=./database/speakfree.db

# JWT
JWT_SECRET=votre_jwt_secret_ici_très_long_et_aléatoire

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Super Admin
SUPER_ADMIN_PASSWORD=200700

# API Claude (optionnel)
ANTHROPIC_API_KEY=votre_clé_api_anthropic_ici
```

### Mesures de Sécurité Implémentées
✅ Helmet.js - En-têtes de sécurité HTTP
✅ CORS - Contrôle d'accès cross-origin
✅ JWT - Authentification sécurisée
✅ Bcrypt - Hashage des mots de passe
✅ Rate Limiting - Protection contre les abus
✅ Validation des entrées
✅ Base de données chiffrée

---

## 📁 Structure du Projet

```
e:\ECOLE V 5\
├── server.js                 # Serveur Express principal
├── seed-data.js             # Script de remplissage BD
├── package.json             # Dépendances npm
├── .env                     # Configuration d'environnement
├── database/
│   └── speakfree.db        # Base de données SQLite
├── public/                  # Fichiers statiques (frontend)
│   ├── index.html          # Page d'accueil
│   ├── statistics.html     # Tableau de bord stats
│   ├── schools-list.html   # Liste des écoles
│   ├── test-api.html       # Page de test API
│   ├── chat-ia.html        # Interface Haniel
│   ├── report.html         # Formulaire signalement
│   ├── discussion.html     # Discussion existante
│   ├── admin.html          # Dashboard admin
│   ├── login.html          # Connexion admin
│   ├── register-school.html # Inscription école
│   ├── super-admin.html    # Interface super admin
│   ├── guide.html          # Guide d'utilisation
│   ├── about.html          # À propos
│   └── terms.html          # Conditions d'utilisation
└── routes/                  # Routes API
    ├── auth.js             # Authentification
    ├── schools.js          # Gestion écoles
    ├── reports.js          # Gestion signalements
    ├── admin.js            # Espace admin
    ├── super-admin.js      # Super admin
    ├── discussions.js      # Discussions
    └── ai-chat.js          # Chat IA
```

---

## 💾 Base de Données

### Tables SQLite

1. **schools** - Écoles inscrites
2. **admins** - Administrateurs des écoles
3. **reports** - Signalements d'incidents
4. **report_files** - Fichiers joints aux signalements
5. **discussions** - Conversations sur les signalements
6. **ai_chat_sessions** - Sessions de chat IA
7. **ai_chat_messages** - Messages du chat IA

---

## 🧪 Tests

### Tester la Connexion Backend-Frontend

Ouvrez dans votre navigateur :
```
http://localhost:3000/test-api.html
```

Cette page teste :
✅ La santé de l'API
✅ L'accessibilité des fichiers statiques
✅ Toutes les routes principales
✅ La connexion backend-frontend

---

## 📈 Statistiques Actuelles

| Métrique | Valeur |
|----------|--------|
| 🏫 Écoles Actives | 5 |
| 📝 Signalements Total | 7 |
| 👨‍💼 Administrateurs | 5 |
| ⏳ En Attente | 2 |
| ⚙️ En Cours | 2 |
| ✅ Résolus | 3 |

---

## 🛠️ Commandes Utiles

```bash
# Démarrer le serveur
npm start

# Remplir la base de données
node seed-data.js

# Voir les logs du serveur
npm start

# Arrêter le serveur
Ctrl + C
```

---

## 🐛 Troubleshooting

### Le serveur ne démarre pas
```bash
# Vérifier la version de Node
node --version

# Réinstaller les modules
npm install
```

### Erreur de connexion à la base de données
```bash
# Vérifier que le fichier .env existe
cat .env

# Recréer la base de données
node seed-data.js
```

### L'API ne répond pas
```bash
# Vérifier que le serveur tourne sur le port 3000
netstat -ano | findstr :3000

# Accédez à http://localhost:3000/api/health
```

---

## 👨‍💻 Développeur

**Haniel DJEBLE**

---

## 📄 Licence

ISC

---

## 📞 Support

Pour toute question ou problème, veuillez contacter le développeur ou consulter la page À propos : http://localhost:3000/about

---

**Dernière mise à jour** : 25 novembre 2025

**Version** : 1.0.0

**Statut** : ✅ Production-Ready
"# parlerlibrement-" 
