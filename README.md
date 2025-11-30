# 💬 SpeakFree - Plateforme de Signalement Anonyme

> Permettre aux élèves de signaler anonymement les incidents dans leur établissement scolaire.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-22.x-green)
![License](https://img.shields.io/badge/license-ISC-orange)

## 🌐 Accès Production

| Service | URL |
|---------|-----|
| 🌐 **Site Web** | https://speakfree-school.netlify.app |
| ⚙️ **API Backend** | https://speakfree-m9xv.onrender.com |
| 🔐 **Super Admin** | https://speakfree-school.netlify.app/super-admin.html (Code: `200700`) |

---

## 🎯 Fonctionnalités

- 🤖 **Assistant IA (Haniel)** - Guide les élèves pour faire un signalement
- 📝 **Signalement anonyme** - Formulaire sécurisé sans identification
- 💬 **Discussions** - Communication anonyme entre élève et administration
- 👨‍💼 **Dashboard Admin** - Gestion des signalements par établissement
- ⚙️ **Super Admin** - Validation et gestion globale des écoles
- 📊 **Statistiques** - Vue d'ensemble en temps réel

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│  Frontend (Netlify)             │
│  HTML/CSS/JavaScript            │
└───────────────┬─────────────────┘
                │ API REST
                ▼
┌─────────────────────────────────┐
│  Backend (Render)               │
│  Node.js / Express              │
└───────────────┬─────────────────┘
                │ MySQL
                ▼
┌─────────────────────────────────┐
│  Base de données                │
│  PlanetScale / Railway          │
└─────────────────────────────────┘
```

---

## 🚀 Installation Locale

### Prérequis
- Node.js v18+ 
- MySQL (local ou cloud)

### Étapes

```bash
# Cloner le repo
git clone https://github.com/hanieljean42-eng/speakfree.git
cd speakfree

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos informations MySQL

# Démarrer le serveur
npm start
```

### Accès
- **Site** : http://localhost:3000
- **Super Admin** : http://localhost:3000/super-admin.html (Code: `200700`)

---

## 🌐 Déploiement Production

### Backend sur Render
1. Connectez votre repo GitHub sur [render.com](https://render.com)
2. Créez un Web Service
3. Configurez les variables d'environnement :
   - `NODE_ENV=production`
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   - `MYSQL_SSL=true`
   - `JWT_SECRET` (généré automatiquement)

### Frontend sur Netlify
1. Connectez votre repo sur [netlify.com](https://netlify.com)
2. **Publish directory** : `public`
3. Mettez à jour `public/config.js` avec l'URL Render

📖 Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md) pour le guide complet.

---

## 📁 Structure du Projet

```
speakfree/
├── server.js              # Serveur Express
├── package.json           # Dépendances
├── .env.example           # Template variables
├── render.yaml            # Config Render
├── DEPLOIEMENT.md         # Guide déploiement
│
├── routes/                # API Routes
│   ├── auth.js            # Authentification
│   ├── schools.js         # Gestion écoles
│   ├── reports.js         # Signalements
│   ├── discussions.js     # Discussions
│   ├── admin.js           # Dashboard admin
│   ├── super-admin.js     # Super admin
│   └── ai-chat.js         # Chat IA
│
├── public/                # Frontend (déployé sur Netlify)
│   ├── index.html         # Accueil
│   ├── chat-ia.html       # Assistant Haniel
│   ├── report.html        # Formulaire signalement
│   ├── discussion.html    # Discussion anonyme
│   ├── login.html         # Connexion admin
│   ├── admin.html         # Dashboard admin
│   ├── super-admin.html   # Gestion globale
│   ├── register-school.html # Inscription école
│   ├── config.js          # Configuration API
│   └── ...
│
├── database/              # Scripts SQL (si besoin)
└── uploads/               # Fichiers uploadés
```

---

## 🔌 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Status serveur |
| GET | `/api/schools/stats/global` | Statistiques globales |
| POST | `/api/schools/register` | Inscription école |
| POST | `/api/auth/login` | Connexion admin |
| POST | `/api/reports` | Créer signalement |
| GET | `/api/reports/:code` | Voir signalement |
| POST | `/api/ai-chat/create-session` | Démarrer chat IA |
| POST | `/api/ai-chat/message` | Envoyer message IA |
| GET | `/api/super-admin/stats` | Stats super admin |
| POST | `/api/super-admin/schools/:id/approve` | Approuver école |

---

## 🔐 Sécurité

- ✅ **Helmet.js** - Headers HTTP sécurisés
- ✅ **CORS** - Contrôle des origines
- ✅ **JWT** - Authentification tokens
- ✅ **Bcrypt** - Hashage mots de passe
- ✅ **Rate Limiting** - Protection DDoS
- ✅ **SSL/TLS** - Connexion MySQL chiffrée

---

## 👨‍💻 Auteur

**Haniel DJEBLE**

---

## 📄 Licence

ISC © 2025 SpeakFree
