# Refactor Firebase content and sync model

## Summary

This refactor moves global app content into a scalable Firebase-backed data model while keeping the mobile app fast, cache-first, and safe to use offline.

## What Changed

- Added bundled fallback content in `appContent.js`.
- Modeled global content in Firestore under `appContent/sanctuary` subcollections:
  - `settings/main`
  - `images`
  - `programs`
  - `potions`
  - `navItems`
  - `communityPosts`
- Added cache-first app content loading with a 5-day cache lifespan.
- Added lightweight Firebase manifest checks using `contentVersion`.
- Added `sectionVersions` for future section-level content refreshes.
- Added Firebase Admin seed tooling via `npm run seed:content`.
- Added Firestore rules and Firebase project config.
- Added user profile sync helpers under `users/{uid}/profile/main`.
- Added coworker setup and Firebase workflow documentation.
- Added `.env.example` for local environment setup.

## Firebase / Security Notes

- Service account JSON files are ignored and should live outside the repo.
- Mobile app uses normal Firebase client config only.
- Firestore rules were deployed to `pythoma-d784a`.
- Global `appContent` is public read and admin-only write.
- User data is scoped under `users/{uid}`.

## How To Test

```powershell
npm install
Copy-Item .env.example .env
npm start
```

For Android:

```powershell
npm run android
```

To reseed global content after editing `appContent.js`:

```powershell
npm.cmd run seed:content
```

To deploy Firestore rules:

```powershell
firebase.cmd login
npm.cmd run deploy:rules
```

## Reviewer Focus

- `App.js`: cache-first content loading and user profile save flow.
- `firebaseConfig.js`: Firebase content/user helper APIs.
- `scripts/seedAppContent.js`: modeled content seeding and version metadata.
- `firestore.rules`: access control boundaries.
- `docs/`: coworker workflow and Firebase data model.
