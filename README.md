# AI Language Learning

An AI-powered language learning assistant designed to provide an immersive and interactive practice environment. Engage in dynamic conversations, master grammar, expand your vocabulary, and test your skills with real-world scenarios.

### Live Demo & Screenshots

https://github.com/user-attachments/assets/afb80c07-449f-48d3-b7ae-88455e3141f8

## Key Features

-   **Dynamic Learning Modes**: Instantly switch between four distinct learning modes to focus your practice:
    -   **💬 Conversation**: Practice natural, open-ended dialogue. The AI corrects mistakes gently and asks follow-up questions to keep the conversation flowing.
    -   **📝 Grammar**: Receive targeted grammar corrections, detailed rule explanations, and practice exercises based on your messages.
    -   **📚 Vocabulary**: Learn new words, synonyms, and usage examples relevant to the conversation.
    -   **🎭 Roleplay**: Immerse yourself in practical scenarios like ordering at a restaurant, checking into a hotel, or navigating an airport.

-   **🎧 Interactive Listening Practice**: Hone your comprehension and pronunciation skills. The AI speaks a sentence in the target language, and you repeat it using your microphone to receive instant feedback and an accuracy score.

-   **📇 AI-Generated Flashcards**: Automatically generate a deck of flashcards based on your conversation history. Study new vocabulary in a dedicated interface, mark cards as "known" or "unknown," and track your progress.

-   **🗣️ Integrated Speech Tools**:
    -   **Speech-to-Text**: Use the microphone to speak your responses instead of typing.
    -   **Text-to-Speech**: Enable "Auto-Read" to have the AI's responses spoken aloud automatically. You can also replay the last message or stop playback at any time.

-   **⚙️ Full Session Management**:
    -   Create, rename, delete, and switch between multiple chat sessions.
    -   Your chat history, language, difficulty, and mode settings are saved automatically for each session.
    -   All data is stored locally in your browser.

-   **🎨 Customizable Experience**:
    -   Select from multiple languages (Spanish, French, Japanese, etc.) and difficulty levels (Beginner, Intermediate, Advanced).
    -   Toggle between light and dark themes for comfortable viewing.

## Tech Stack

-   **Frontend**: HTML5, CSS3, Vanilla JavaScript
-   **Backend**: Node.js, Express
-   **AI Service**: [OpenRouter API](https://openrouter.ai/)
-   **Data Persistence**: Browser `LocalStorage` for chat sessions, flashcards, and user settings.

## Getting Started

Follow these instructions to get a local copy up and running.

### Prerequisites

-   Node.js and npm
-   An API key from [OpenRouter](https://openrouter.ai/keys)

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/deryokoya/ai-language-learning.git
    ```

2.  **Navigate to the project directory:**
    ```sh
    cd ai-language-learning
    ```

3.  **Install NPM packages:**
    ```sh
    npm install
    ```

4.  **Create an environment file:**
    Create a file named `.env` in the root of the project and add your OpenRouter API key:
    ```
    OPENROUTER_API_KEY="your_api_key_here"
    ```

5.  **Run the application:**
    For development with automatic reloading:
    ```sh
    npm run dev
    ```
    For a standard start:
    ```sh
    npm start
    ```

6.  **Open the application:**
    Navigate to `http://localhost:3000` in your web browser.
