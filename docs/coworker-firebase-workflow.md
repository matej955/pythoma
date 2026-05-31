# Coworker Firebase Workflow

Use this when joining the project or adding new synced data.

## 1. Local App Setup

```powershell
npm install
Copy-Item .env.example .env
```

Fill `.env` with Firebase Console values. Do not commit `.env`.

Run:

```powershell
npm start
```

Android:

```powershell
npm run android
```

If PowerShell blocks npm, use `npm.cmd`.

## 2. Admin Key Setup

Only coworkers who seed content need a Firebase Admin service account key.

Download one from:

```text
Firebase Console > Project settings > Service accounts > Generate new private key
```

Move it outside the repo:

```text
C:\Users\User\.firebase-keys\pythoma-service-account.json
```

Never commit this file. Never import it into app code.

## 3. Editing Global App Content

Current development source:

```text
appContent.js
```

After changing programs, potions, images, nav items, or global settings:

```powershell
npm.cmd run seed:content
```

This updates the Firestore content model:

```text
appContent/sanctuary
appContent/sanctuary/settings/main
appContent/sanctuary/images/{imageKey}
appContent/sanctuary/programs/{programId}
appContent/sanctuary/potions/{potionId}
appContent/sanctuary/navItems/{navKey}
appContent/sanctuary/communityPosts/{postId}
```

It also updates the manifest version markers:

```text
contentVersion
sectionVersions
```

The app uses these to avoid unnecessary downloads.

## 4. Adding New App Content Sections

When adding a new global content type:

1. Add fallback data to `appContent.js`.
2. Add it to the seed script subcollection list in `scripts/seedAppContent.js`.
3. Add fetch/normalization support in the appropriate `services/*Service.ts` file and `App.js`.
4. Add a short note to `docs/firebase-data-model.md`.
5. Reseed Firebase.

Prefer small documents and screen-specific collections. Do not add one huge document.

## 5. Adding User-Specific Data

User data goes under:

```text
users/{uid}/...
```

Examples:

```text
users/{uid}/profile/main
users/{uid}/progress/{programId}
users/{uid}/preferences/main
users/{uid}/savedContent/{contentId}
```

Add helper functions in the appropriate `services/*Service.ts` file. Keep app screens unaware of raw Firestore paths when possible.

## 6. Chat And Live Data

Use live listeners for data that must feel real-time:

```text
communityMessages/{messageId}
communityMessages/{messageId}/likes/{uid}
```

Do not use live listeners for mostly static global app content. Use cache-first plus manifest checks.

## 7. Firestore Rules

Rules live in:

```text
firestore.rules
```

Deploy:

```powershell
firebase.cmd login
npm.cmd run deploy:rules
```

Rules protect:

- Public reads for `appContent`.
- Authenticated writes for chat.
- Private reads/writes for `users/{uid}`.
- Admin-only writes for app content.

## 8. Future Web Admin Interface

The future web interface should not invent a new data model. It should write to the same `appContent/sanctuary/...` subcollections and update `contentVersion`/`sectionVersions`.

Recommended future flow:

1. Admin edits programs/potions/settings in the web UI.
2. Web UI writes small section documents to Firestore.
3. Web UI updates root manifest hashes.
4. Mobile app checks manifest on open.
5. Mobile app downloads only when content changed.

If web admin runs on a server, use Admin SDK there. If it runs as a client-only admin panel, protect writes with custom admin claims and Firestore rules.
