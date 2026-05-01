# 🌍 AI Language Learning

An AI-powered language learning assistant that provides an immersive, interactive practice environment. Engage in dynamic conversations, master grammar, expand vocabulary, and test your skills with real-world scenarios. All powered by a modern Node.js backend with full user authentication and persistent cloud storage.

> **Demo video and screenshots** in the `/screenshots` directory. A showcase video is also available via the GitHub Releases / assets section of the repository.

---

https://github.com/user-attachments/assets/afb80c07-449f-48d3-b7ae-88455e3141f8

## ✨ Features

### 💬 Four Dynamic Learning Modes
Switch instantly between focused practice styles:
- **Conversation** — Practice natural, open-ended dialogue. The AI gently corrects mistakes and asks follow-up questions.
- **Grammar** — Receive targeted corrections, detailed rule explanations, and practice exercises.
- **Vocabulary** — Learn new words, synonyms, and contextual usage examples.
- **Roleplay** — Immerse yourself in real-world scenarios such as ordering at a restaurant, checking into a hotel, or navigating an airport.

### 🎧 Interactive Listening Practice
The AI speaks a sentence in the target language, you repeat it using your microphone, and you get instant feedback with an accuracy score to sharpen both comprehension and pronunciation.

### 📇 AI-Generated Flashcards
Automatically generate a vocabulary deck from your conversation history. Study in a dedicated flashcard interface, mark cards as known or unknown, and track progress over time.

### 🗣️ Integrated Speech Tools
- **Speech-to-Text** — Speak your responses instead of typing.
- **Text-to-Speech** — Enable Auto-Read to have AI responses spoken aloud. Replay or stop playback at any time.

### 🔐 Full User Authentication
- Secure sign-up and login with **bcrypt**-hashed passwords.
- **JWT-based** access tokens (15-minute expiry) with rotating **refresh tokens** (30-day expiry) stored as HttpOnly cookies.
- Token rotation on every refresh and explicit logout revocation.

### ☁️ Cloud Data Persistence
When logged in, all chat sessions, messages, flashcards, and settings sync to a **PostgreSQL** database, so your data follows you across devices.

### ⚙️ Session Management
- Create, rename, delete, and switch between multiple chat sessions.
- Per-session language, difficulty, mode, and auto-read settings are saved automatically.
- Guests use browser `localStorage`; authenticated users sync to the cloud.

### 🎨 Customizable Experience
- Languages: Spanish, French, German, Italian, Japanese, Korean, and Mandarin Chinese.
- Difficulty levels: Beginner, Intermediate, Advanced.
- Light and dark theme toggle.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express 5 |
| **AI Service** | [OpenRouter API](https://openrouter.ai/) (OpenAI-compatible) |
| **Database** | PostgreSQL (`pg`) |
| **Auth** | JWT (`jsonwebtoken`) + bcrypt |
| **Dev tooling** | Nodemon, dotenv |

---

## 📁 Project Structure

```
ai-language-learning/
├── public/                   # Static frontend
│   ├── index.html
│   ├── styles.css
│   ├── logo.svg / logo.ico
│   └── js/
│       ├── main.js           # App entry point & UI logic
│       ├── auth.js           # Authentication flow
│       ├── chat.js           # Chat session management
│       ├── flashcards.js     # Flashcard interface
│       ├── listening.js      # Listening practice module
│       ├── appStorage.js     # Cloud storage sync
│       └── storage.js        # Local storage helpers
├── src/
│   ├── controllers/
│   │   ├── aiController.js       # AI prompt construction & OpenRouter calls
│   │   ├── authController.js     # Signup, login, logout, refresh, /me
│   │   ├── chatController.js     # Chat CRUD + message management
│   │   ├── flashcardController.js
│   │   ├── storageController.js  # Key/value cloud storage per user
│   │   └── userController.js
│   ├── db/
│   │   ├── connection.js         # pg Pool setup
│   │   └── schema.sql            # Full DB schema
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT verification middleware
│   ├── routes/
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── chats.js
│   │   ├── flashcards.js
│   │   ├── storage.js
│   │   └── users.js
│   ├── services/
│   │   └── openrouter.js         # OpenAI-compatible client for OpenRouter
│   └── utils/
│       ├── hash.js               # bcrypt helpers
│       └── jwt.js                # Access & refresh token signing/verification
├── screenshots/
├── server.js                 # Express app entry point
├── package.json
└── .env                      # Environment variables (not committed)
```

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `users` | Email, hashed password, display name |
| `refresh_tokens` | Persisted refresh tokens with expiry |
| `user_settings` | Per-user theme, language, difficulty, auto-read preferences |
| `user_storage` | Generic key/value store for syncing client state |
| `chats` | Chat sessions with mode, language, difficulty, scenario settings |
| `chat_messages` | Individual messages (sender, text, HTML) per chat |
| `flashcards` | Vocabulary cards with known/unknown status and review count |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ and **npm**
- A **PostgreSQL** database (local or hosted)
- An **OpenRouter API key** — [get one here](https://openrouter.ai/keys)

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/deryokoya/ai-language-learning.git
   cd ai-language-learning
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Set up the database**

   Run the schema file against your PostgreSQL instance:
   ```sh
   psql -U <your_user> -d <your_database> -f src/db/schema.sql
   ```

4. **Configure environment variables**

   Create a `.env` file in the project root:
   ```env
   OPENROUTER_API_KEY="your_openrouter_api_key_here"

   # PostgreSQL connection string
   DATABASE_URL="postgresql://user:password@localhost:5432/your_database"

   # JWT secret (use long, random strings)
   JWT_SECRET="your_jwt_secret_here"
   ```

5. **Run the application**

   Development mode (auto-reload with Nodemon):
   ```sh
   npm run dev
   ```

   Production mode:
   ```sh
   npm start
   ```

6. **Open in your browser**
   ```
   http://localhost:3000
   ```

---

## 🔌 API Reference

All API routes are prefixed with `/api`.

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup` | Register a new user |
| `POST` | `/login` | Log in and receive tokens |
| `POST` | `/logout` | Revoke refresh token and clear cookies |
| `POST` | `/refresh` | Rotate refresh token, issue new access token |
| `GET` | `/me` | Return current authenticated user |

### Chats — `/api/chats` *(requires auth)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all chats for the user |
| `GET` | `/:id` | Get a single chat with its messages |
| `POST` | `/` | Create a new chat session |
| `PUT` | `/:id` | Update chat settings (title, mode, language, etc.) |
| `DELETE` | `/:id` | Delete a chat and all its messages |
| `POST` | `/:id/messages` | Append a message to a chat |

### Flashcards — `/api/flashcards` *(requires auth)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List all flashcards |
| `POST` | `/` | Add a new flashcard |
| `PUT` | `/:id` | Update a flashcard (e.g., mark known) |
| `DELETE` | `/:id` | Delete a flashcard |

### AI — `/api/ai`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ask` | Send a prompt; returns an AI tutor response |

### Storage — `/api/storage` *(requires auth)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:key` | Retrieve a stored value by key |
| `PUT` | `/:key` | Set / upsert a stored value |
| `DELETE` | `/:key` | Delete a stored key |

---

## 🔒 Authentication Design

- **Access tokens** — short-lived JWTs (15 min) delivered as an `HttpOnly` cookie.
- **Refresh tokens** — long-lived JWTs (30 days) stored in both an `HttpOnly` cookie (path-restricted to `/api/auth/refresh`) and the database for revocation.
- **Token rotation** — every refresh call deletes the old token and issues a new pair, preventing replay attacks.
- **Logout** — explicitly deletes the refresh token from the database and clears both cookies.

---

## 📸 Screenshots

UI snapshot:

![Early Screenshot](screenshots/earlyscreenshot.png)

Flashcard interface:

![Flashcard Example](screenshots/flashcardexample.png)

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

This project is open source. See the repository for license details.
