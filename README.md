# Pythoma Sanctuary

Expo React Native prototype for a Croatian fitness and wellness subscription app for women.

Run the native app with Expo:

```powershell
npm install
npm start
```

The original static web prototype is still present in `index.html`, `styles.css`, and `app.js` as a reference.

## Firebase setup

Copy `.env.example` to `.env` and fill in your Firebase web app config. `firebaseConfig.js` reads those `EXPO_PUBLIC_...` values automatically.

In Firebase Console:

1. Go to Project settings.
2. Add a Web app if you have not already.
3. Copy `apiKey`, `appId`, `messagingSenderId`, `projectId`, etc.
4. Go to Authentication > Sign-in method.
5. Enable Email/Password and Google.

For Google sign-in in Expo, also paste your Google OAuth client IDs into `googleClientIds` in `firebaseConfig.js`.

Native Firebase files are included for development builds:

- `GoogleService-Info.plist`
- `google-services.json`
