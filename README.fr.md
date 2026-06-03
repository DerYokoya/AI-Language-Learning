**Français** | [English](./README.md)

# 🌍 Apprentissage des langues par l'IA

Une plateforme d'apprentissage des langues par l'IA « full-stack » qui offre un environnement d'entraînement immersif et interactif. Participez à des conversations dynamiques, maîtrisez la grammaire, enrichissez votre vocabulaire et testez vos compétences à travers des scénarios concrets. Le tout s'appuie sur un backend Node.js moderne, avec une authentification complète des utilisateurs et un stockage persistant dans le cloud.

> **Vidéo de démonstration et captures d'écran** dans le répertoire `/screenshots`.

---

## Voir en ligne

[![Démonstration en direct](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://ai-language-learning.onrender.com/)

---

## Vidéo de présentation

https://github.com/user-attachments/assets/afb80c07-449f-48d3-b7ae-88455e3141f8

---

## Captures d'écran

<p align="center">
  <img src="screenshots/FlashcardsScreenshot.png" width="32%" />
  <img src="screenshots/DarkThemeScreenshot.png" width="32%" /> 
  <img src="screenshots/GrammarScreenshot.png" width="32%" />
</p>

*De gauche à droite : interface des fiches, aperçu du mode sombre et mode grammaire.*

---

## Présentation

AI Language Learning est une application web full-stack qui offre un environnement interactif pour pratiquer les langues étrangères avec un tuteur IA.

Les utilisateurs peuvent suivre des modes d'apprentissage structurés tels que la conversation, la correction grammaticale, l'enrichissement du vocabulaire et des jeux de rôle basés sur des scénarios. Le système conserve les sessions de chat, l'historique d'apprentissage et les fiches de révision afin de soutenir la progression à long terme.

L'application est construite selon une architecture client-serveur RESTful utilisant un backend Node.js + Express et un frontend JavaScript vanilla. Elle intègre un modèle d'IA via OpenRouter et stocke les données utilisateur dans une base de données PostgreSQL.

L'objectif de ce projet est de simuler une plateforme d'apprentissage de type production avec authentification, état persistant et services backend modulaires, plutôt qu'une simple interface de chat.

---

## Fonctionnalités

### Quatre modes d'apprentissage dynamiques
Passez instantanément d'un style d'entraînement ciblé à un autre :
- **Conversation** — Entraînez-vous à des dialogues naturels et ouverts. L'IA corrige en douceur les erreurs et pose des questions complémentaires.
- **Grammaire** — Bénéficiez de corrections ciblées, d'explications détaillées des règles et d'exercices pratiques.
- **Vocabulaire** — Apprenez de nouveaux mots, des synonymes et des exemples d'utilisation en contexte.
- **Jeu de rôle** — Plongez-vous dans des scénarios réels tels que passer une commande au restaurant, s'enregistrer à l'hôtel ou s'orienter dans un aéroport.

### Exercices d'écoute interactifs
L'IA prononce une phrase dans la langue cible, vous la répétez à l'aide de votre microphone et vous obtenez un retour instantané avec un score de précision pour affiner à la fois votre compréhension et votre prononciation.

### Fiches de vocabulaire générées par l'IA
Générez automatiquement un jeu de fiches de vocabulaire à partir de votre historique de conversations. Étudiez dans une interface dédiée aux fiches, marquez les cartes comme connues ou inconnues et suivez vos progrès au fil du temps.

### Outils vocaux intégrés
- **Reconnaissance vocale** — Exprimez vos réponses à l'oral plutôt qu'à l'écrit.
- **Synthèse vocale** — Activez la lecture automatique pour que les réponses de l'IA soient lues à voix haute. Relancez ou arrêtez la lecture à tout moment.

### Authentification complète de l'utilisateur
- Inscription et connexion sécurisées grâce à des mots de passe hachés avec **bcrypt**.
- Jetons d'accès **basés sur JWT** (expiration après 15 minutes) avec des **jetons de rafraîchissement** rotatifs (expiration après 30 jours) stockés sous forme de cookies HttpOnly.
- Rotation des jetons à chaque rafraîchissement et révocation explicite lors de la déconnexion.

### Persistance des données dans le cloud
Une fois connecté, toutes les sessions de chat, les messages, les fiches et les paramètres sont synchronisés vers une base de données **PostgreSQL**, afin que vos données vous suivent sur tous vos appareils.

### Gestion des sessions
- Créez, renommez, supprimez et passez d'une session de chat à l'autre.
- Les paramètres de langue, de difficulté, de mode et de lecture automatique par session sont enregistrés automatiquement.
- Les invités utilisent le `localStorage` du navigateur ; les utilisateurs authentifiés se synchronisent avec le cloud.

### Expérience personnalisable
- Langues : espagnol, français, allemand, italien, japonais, coréen, mandarin, portugais, arabe standard moderne et hindi.
- Niveaux de difficulté : débutant, intermédiaire, avancé.
- Basculer entre les thèmes clair et sombre.

---

## Architecture du système

Le système est conçu comme une architecture full-stack en couches séparant l'interface utilisateur, la logique API, les services et la persistance pour assurer l'évolutivité et la maintenabilité.

```
Frontend (Vanilla JS)
        ↓
API REST (Express)
        ↓
Couche de contrôleurs
        ↓
Services (IA / Authentification / Logique)
        ↓
Base de données PostgreSQL
```

---

## Pile technologique

| Couche | Technologie |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express 5 |
| **Style d'architecture** | API RESTful |
| **Service IA** | [API OpenRouter](https://openrouter.ai/) (compatible OpenAI) |
| **Base de données** | PostgreSQL (`pg`) |
| **Stockage** | Système hybride cloud + local |
| **Auth** | JWT (`jsonwebtoken`) (rotation des jetons) + bcrypt |
| **Outils de développement** | Nodemon, dotenv |

---
## Référence API

Toutes les routes API sont préfixées par `/api`.

### Authentification — `/api/auth`
| Méthode | Point de terminaison | Description |
|---|---|---|
| `POST` | `/signup` | Enregistrer un nouvel utilisateur |
| `POST` | `/login` | Se connecter et recevoir des jetons |
| `POST` | `/logout` | Révoquer le jeton de rafraîchissement et effacer les cookies |
| `POST` | `/refresh` | Renouveler le jeton de rafraîchissement, émettre un nouveau jeton d'accès |
| `GET` | `/me` | Renvoyer l'utilisateur actuellement authentifié |

### Chats — `/api/chats` *(authentification requise)*
| Méthode | Point de terminaison | Description |
|---|---|---|
| `GET` | `/` | Lister tous les chats de l'utilisateur |
| `GET` | `/:id` | Récupérer un chat et ses messages |
| `POST` | `/` | Créer une nouvelle session de chat |
| `PUT` | `/:id` | Mettre à jour les paramètres du chat (titre, mode, langue, etc.) |
| `DELETE` | `/:id` | Supprimer un chat et tous ses messages |
| `POST` | `/:id/messages` | Ajouter un message à un chat |

### Fiches — `/api/flashcards` *(authentification requise)*
| Méthode | Point de terminaison | Description |
|---|---|---|
| `GET` | `/` | Lister toutes les fiches |
| `POST` | `/` | Ajouter une nouvelle fiche |
| `PUT` | `/:id` | Mettre à jour une fiche (par ex., marquer comme connue) |
| `DELETE` | `/:id` | Supprimer une fiche |

### IA — `/api/ai`
| Méthode | Point de terminaison | Description |
|---|---|---|
| `POST` | `/ask` | Envoyer une requête ; renvoie une réponse du tuteur IA |

### Stockage — `/api/storage` *(authentification requise)*
| Méthode | Point de terminaison | Description |
|---|---|---|
| `GET` | `/:key` | Récupérer une valeur stockée par clé |
| `PUT` | `/:key` | Définir / mettre à jour une valeur stockée |
| `DELETE` | `/:key` | Supprimer une clé stockée |

---

## Schéma de la base de données

| Table | Objectif |
|---|---|
| `users` | E-mail, mot de passe haché, nom d'affichage |
| `refresh_tokens` | Jetons de rafraîchissement persistants avec date d'expiration |
| `user_settings` | Thème, langue, niveau de difficulté et préférences de lecture automatique par utilisateur |
| `user_storage` | Stockage clé/valeur générique pour la synchronisation de l'état du client |
| `chats` | Sessions de chat avec paramètres de mode, langue, niveau de difficulté et scénario |
| `chat_messages` | Messages individuels (expéditeur, texte, HTML) par discussion |
| `flashcards` | Fiches de vocabulaire avec statut connu/inconnu et nombre de révisions |

---

## Structure du projet

```
ai-language-learning/
├── public/                   # Interface statique
│   ├── index.html
│   ├── styles.css
│   ├── logo.svg / logo.ico
│   └── js/
│       ├── main.js           # Point d'entrée de l'application et logique de l'interface utilisateur
│       ├── auth.js           # Flux d'authentification
│       ├── chat.js           # Gestion des sessions de chat
│       ├── flashcards.js     # Interface des fiches de vocabulaire
│       ├── listening.js      # Module d'entraînement à l'écoute
│       ├── appStorage.js     # Synchronisation du stockage cloud
│       └── storage.js        # Aides au stockage local
├── src/
│   ├── controllers/
│   │   ├── aiController.js       # Construction des invites IA & appels OpenRouter
│   │   ├── authController.js     # Inscription, connexion, déconnexion, actualisation, /me
│   │   ├── chatController.js     # CRUD du chat + gestion des messages
│   │   ├── flashcardController.js
│   │   ├── storageController.js  # Stockage cloud clé/valeur par utilisateur
│   │   └── userController.js
│   ├── db/
│   │   ├── connection.js         # Configuration du pool pg
│   │   └── schema.sql            # Schéma complet de la base de données
│   ├── middleware/
│   │   └── authMiddleware.js     # Middleware de vérification JWT
│   ├── routes/
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── chats.js
│   │   ├── flashcards.js
│   │   ├── storage.js
│   │   └── users.js
│   ├── services/
│   │   └── openrouter.js         # Client compatible OpenAI pour OpenRouter
│   └── utils/
│       ├── hash.js               # Aides bcrypt
│       └── jwt.js                # Signature/vérification des jetons d'accès et de rafraîchissement
├── screenshots/
├── server.js                 # Point d'entrée de l'application Express
├── package.json
└── .env                      # Variables d'environnement (non validées)
```

---

## Conception de l'authentification

- **Jetons d'accès** — JWT à courte durée de vie (15 min) fournis sous forme de cookie `HttpOnly`.
- **Jetons de rafraîchissement** — JWT à longue durée de vie (30 jours) stockés à la fois dans un cookie `HttpOnly` (dont l'accès est limité au chemin `/api/auth/refresh`) et dans la base de données en vue de leur révocation.
- **Rotation des jetons** — chaque appel de rafraîchissement supprime l'ancien jeton et émet une nouvelle paire, empêchant ainsi les attaques par rejeu.
- **Déconnexion** — supprime explicitement le jeton d'actualisation de la base de données et efface les deux cookies.

---

## Défis

- Synchronisation de l'état du chat IA avec le stockage persistant en base de données
- Conception d'une rotation sécurisée des jetons avec révocation des jetons d'actualisation
- Gestion d'un système de stockage double (localStorage vs PostgreSQL)
- Structuration de contrôleurs backend modulaires pour l'évolutivité

## Pour commencer

### Prérequis
- **Node.js** v18+ et **npm**
- Une base de données **PostgreSQL** (locale ou hébergée)
- Une **clé API OpenRouter** — [obtenez-en une ici](https://openrouter.ai/keys)

### Installation

1. **Cloner le dépôt**
   ```sh
   git clone https://github.com/deryokoya/ai-language-learning.git
   cd ai-language-learning
   ```

2. **Installez les dépendances**
   ```sh
   npm install
   ```

3. **Configurez la base de données**

   Exécutez le fichier de schéma sur votre instance PostgreSQL :
   ```sh
   psql -U <votre_utilisateur> -d <votre_base_de_données> -f src/db/schema.sql
   ```

4. **Configurer les variables d'environnement**

   Créez un fichier `.env` à la racine du projet :
   ```env
   OPENROUTER_API_KEY="votre_clé_api_openrouter_ici"

   # Chaîne de connexion PostgreSQL
   DATABASE_URL="postgresql://utilisateur:mot_de_passe@localhost:5432/votre_base_de_données"

   # Secret JWT (utilisez des chaînes longues et aléatoires)
   JWT_SECRET="votre_secret_jwt_ici"
   ```

5. **Lancer l'application**

   Mode développement (rechargement automatique avec Nodemon) :
   ```sh
   npm run dev
   ```

   Mode production :
   ```sh
   npm start
   ```

6. **Ouvrez dans votre navigateur**
   ```
   http://localhost:3000
   ```

---

## Contribuer

Les pull requests sont les bienvenues. Pour les modifications importantes, veuillez d'abord ouvrir un ticket afin de discuter des changements que vous souhaitez apporter.

---

## Licence

Ce projet est open source. Consultez le dépôt pour plus de détails sur la licence.
