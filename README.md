# Euonia

Euonia is an AI-powered conversational therapy application designed to provide empathetic and evidence-based support. It leverages advanced AI models and integrates with goal management functionalities to help users track and achieve their personal objectives.

## Features

-   **AI-Powered Conversational Therapy:** Engage in empathetic and supportive conversations with an AI therapist.
-   **Goal Management:** Set, track, update, and resolve personal goals directly within the chat interface.
-   **Firebase Integration:** Secure user authentication and persistent storage for chat interactions and goals.
-   **Tool Calling:** AI model can intelligently call functions to manage goals based on user requests.
-   **Real-time Updates:** See chat messages and goal updates in real-time.
-   **Responsive UI:** A clean and intuitive user interface built with SvelteKit.

## Technologies Used

-   **Frontend:** SvelteKit, HTML, CSS (Tailwind CSS for styling)
-   **Backend:** SvelteKit (server-side rendering and API routes)
-   **Database:** Firebase Firestore
-   **Authentication:** Firebase Authentication
-   **AI Model:** OpenAI API (via NVIDIA API endpoint)
-   **Deployment:** Vercel (or similar Node.js compatible hosting)

## Getting Started

Follow these instructions to set up and run Euonia locally on your machine.

### Prerequisites

-   Node.js (v18 or higher recommended)
-   npm or Yarn
-   Firebase Project (with Firestore and Authentication enabled)
-   OpenAI API Key (or NVIDIA API Key for Moonshot AI)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/euonia.git
    cd euonia
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Firebase:**
    -   Go to the Firebase Console and create a new project.
    -   Enable Firestore and Firebase Authentication (Email/Password or Anonymous is sufficient for basic setup).
    -   Create a `firebaseConfig.ts` file in `$lib/Firebase/` (e.g., `src/lib/Firebase/firebase.client.ts`) with your Firebase client configuration:

        ```typescript
        // src/lib/Firebase/firebase.client.ts
        import { initializeApp, getApps, getApp } from 'firebase/app';
        import { getFirestore } from 'firebase/firestore';
        import { getAuth } from 'firebase/auth';

        const firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_AUTH_DOMAIN",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        };

        function initializeFirebaseClient() {
            if (!getApps().length) {
                const app = initializeApp(firebaseConfig);
                return {
                    app,
                    auth: getAuth(app),
                    firestore: getFirestore(app)
                };
            } else {
                const app = getApp();
                return {
                    app,
                    auth: getAuth(app),
                    firestore: getFirestore(app)
                };
            }
        }

        export const firebaseClient = initializeFirebaseClient;
        ```
    -   For Firebase Admin SDK (server-side), you'll need a service account key. Download the JSON file from Firebase Console -> Project settings -> Service accounts.
    -   Place the JSON file (e.g., `serviceAccountKey.json`) in your project root or a secure location.
    -   Update `src/lib/Firebase/firebase.server.ts` to initialize the Admin SDK with your service account key.

4.  **Environment Variables:**
    Create a `.env` file in the root of your project and add the following:

    ```
    NVIDIA_API_KEY="YOUR_NVIDIA_API_KEY" # Required for Moonshot AI model
    ```
    Replace `"YOUR_..."` with your actual API keys.

### Running the Application

To start the development server:

```bash
npm run dev
# or
yarn dev
```

Open your browser and navigate to `http://localhost:5173` (or the port indicated in your terminal).

## Usage

1.  **Sign In:** Upon opening the application, you'll be prompted to sign in (anonymous sign-in is supported).
2.  **Chat:** Type your messages in the input field and press Enter or click the send button.
3.  **Set Goals:** You can ask Euonia to set goals for you, e.g., "Set a goal to exercise for 30 minutes daily, due by next Friday, with high priority."
4.  **View Goals:** Your goals will appear in the "My Goals" sidebar.
5.  **Manage Goals:** You can ask Euonia to update or resolve your goals, e.g., "Mark my exercise goal as complete." or "Update my exercise goal to be 45 minutes."

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
