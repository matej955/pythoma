# Pythoma Sanctuary

Expo React Native app for Pythoma Sanctuary, backed by Firebase for authentication, global app content, community chat, and user-specific sync.

## First Setup

1. Install dependencies:

```powershell
npm install
```

2. Create your local `.env` from the example:

```powershell
Copy-Item .env.example .env
```

3. Fill `.env` with the Firebase Web app config and Google OAuth client IDs from Firebase Console.

4. Run the app:

```powershell
npm start
```

For Android development builds:

```powershell
npm run android
```

Use `npm.cmd ...` instead of `npm ...` if PowerShell blocks npm scripts on your machine.

## Firebase Content Model

Global content is stored in Firestore under:

```text
appContent/sanctuary
appContent/sanctuary/settings/main
appContent/sanctuary/images/{imageKey}
appContent/sanctuary/programs/{programId}
appContent/sanctuary/potions/{potionId}
appContent/sanctuary/navItems/{navKey}
appContent/sanctuary/communityPosts/{postId}
```

The app keeps fallback content in [appContent.js](appContent.js). This file is the source for seeding Firebase during development.

Runtime behavior:

1. The app loads bundled fallback content.
2. It loads valid cached content from the phone if available.
3. It checks the lightweight Firebase manifest `appContent/sanctuary`.
4. If `contentVersion` is unchanged, it keeps cache.
5. If content changed or cache expired, it downloads the modeled content sections.

The global content cache lifespan is currently 5 days.

More detail: [docs/firebase-data-model.md](docs/firebase-data-model.md).

## Updating App Content

For now, update global content in [appContent.js](appContent.js), then seed Firebase:

```powershell
npm.cmd run seed:content
```

The seed script writes the modeled Firestore structure and updates:

```text
contentVersion
sectionVersions
updatedAt
contentType
```

Later, the planned web admin interface should write to the same Firestore model instead of editing `appContent.js` manually.

## Service Account Key

Do not commit Firebase service account JSON files.

For local admin seeding, store the Firebase Admin key outside the repo at:

```text
C:\Users\User\.firebase-keys\pythoma-service-account.json
```

The seed script automatically checks that location. If a coworker needs seeding access, they should generate their own service account key in Firebase Console and store it there.

Never ship this key with the app.

## Deploying Firestore Rules

Firestore rules live in [firestore.rules](firestore.rules), configured by [firebase.json](firebase.json).

Install/login once:

```powershell
npm.cmd install -g firebase-tools
firebase.cmd login
```

Deploy rules:

```powershell
npm.cmd run deploy:rules
```

Rules are deployed to project:

```text
pythoma-d784a
```

## User Data

Private user data belongs under:

```text
users/{uid}
users/{uid}/profile/main
users/{uid}/progress/{programId}
users/{uid}/preferences/main
users/{uid}/savedContent/{contentId}
```

Current app support:

- Profile edits sync to `users/{uid}/profile/main`.
- Community messages write to `communityMessages`.
- Likes write to `communityMessages/{messageId}/likes/{uid}`.

Future user-specific features should use `users/{uid}/...`, not `appContent`.

## What Goes Where

Use app bundle / code for:

- React Native screens and navigation.
- Required fallback content.
- Validation and business logic.
- Cache/sync behavior.

Use Firestore `appContent` for:

- Programs.
- Potions/recipes.
- Navigation labels/items.
- UI settings and copy.
- Remote image URLs or Storage paths.

Use Firestore `users/{uid}` for:

- Profile.
- Progress.
- Preferences.
- Saved content.

Use Firestore live collections for:

- Chat.
- Likes/reactions.
- Other real-time community features.

Use Firebase Storage or external hosting for:

- Large images.
- Videos.
- User-uploaded media.

Firestore should store metadata, URLs, and paths, not large blobs.
