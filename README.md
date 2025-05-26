# Teleparty Chat Application

A real-time chat application built with React, TypeScript, and Firebase. This application provides persistent message storage, real-time synchronization, and seamless cross-device access.

## Features

- **Real-time Messaging**: Instant message delivery using WebSocket connections
- **Persistent Storage**: Messages stored in Firebase Firestore for cross-session persistence
- **Room Management**: Create and join chat rooms with unique IDs
- **Typing Indicators**: See when other users are typing
- **Cross-device Sync**: Access chat history from any device
- **Offline Support**: Built-in offline capabilities with Firebase
- **Message Migration**: Automatic migration from local storage to Firebase

## Tech Stack

- **Frontend**: React 19, TypeScript, Chakra UI
- **Backend**: Firebase Firestore
- **Real-time**: Teleparty WebSocket Library
- **Local Storage**: IndexedDB (with Dexie.js)
- **Styling**: Chakra UI with Emotion

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

Before running the application, you need to set up Firebase:

1. Follow the detailed instructions in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
2. Create a `.env` file with your Firebase configuration
3. Enable Firestore Database in your Firebase project

### 3. Run the Application

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Available Scripts

### `npm start`

Runs the app in development mode. The page will reload if you make edits.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder. The build is optimized for best performance.

### `npm run deploy`

Deploys the application to GitHub Pages (requires `gh-pages` setup).

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # UI components (toaster, etc.)
│   ├── ChatScreen.tsx  # Main chat interface
│   ├── MessageList.tsx # Message display component
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useTelepartyChat.ts    # Main chat logic
│   ├── useUsernameValidation.ts
│   └── useClipboard.ts
├── services/           # External service integrations
│   ├── firebaseService.ts     # Firebase Firestore operations
│   └── database.ts            # IndexedDB operations
├── config/             # Configuration files
│   └── firebase.ts     # Firebase configuration
└── App.tsx            # Main application component
```

## How It Works

1. **Connection**: Users connect via WebSocket using the Teleparty library
2. **Room Management**: Create or join rooms with unique IDs
3. **Message Flow**: 
   - Messages sent via WebSocket for real-time delivery
   - Simultaneously saved to Firebase for persistence
   - Real-time listeners update all connected clients
4. **Storage Strategy**:
   - Primary: Firebase Firestore (cloud storage)
   - Fallback: IndexedDB (local storage)
   - Automatic migration from local to cloud storage

## Firebase Integration

The application uses Firebase Firestore for:

- **Message Storage**: All chat messages with metadata
- **Room Management**: Room information and participant tracking
- **Real-time Updates**: Live synchronization across all clients
- **Offline Support**: Automatic offline/online handling

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed setup instructions.

## Development

### Environment Variables

Create a `.env` file in the project root:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### Local Development with Firebase Emulator

For local development without affecting production data:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Start Firestore emulator
firebase emulators:start --only firestore

# Set environment variable
REACT_APP_USE_FIREBASE_EMULATOR=true
```

## Deployment

The application can be deployed to various platforms:

### GitHub Pages
```bash
npm run deploy
```

### Vercel, Netlify, etc.
Build the project and deploy the `build` folder:
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Learn More

- [React Documentation](https://reactjs.org/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Chakra UI Documentation](https://chakra-ui.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
