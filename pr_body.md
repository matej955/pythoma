# Structure Firebase models and admin-ready data contracts

## Summary

This PR defines the Firebase data model foundation for the mobile app and the future owner/admin web app. It centralizes collection names, documents the canonical entities, adds roles and permissions, introduces app-owned analytics events, and prepares Firestore rules for the next phase of structured content and admin management.

## What Changed

- Added `firebaseModels.js` as the shared source of truth for:
  - Firebase collection names
  - document constants and subcollections
  - model field contracts
  - roles and permissions
  - analytics event names and event-specific collections
- Added `FIREBASE_MODELS.md` with the human-readable model reference.
- Added canonical models for:
  - `User`
  - `Workout`
  - `Program`
  - `Exercise`
  - `Recipe`
  - `Subscription`
  - `Progress`
  - `WorkoutSession`
  - `CommunityPost`
  - `CommunityAttachment`
  - `Comment`
  - `Notification`
  - `MediaAsset`
  - `Report`
  - `ModerationAction`
  - `CoachAssignment`
  - `AdminAuditLog`
  - `AppSettings`
  - `AppNavigation`
  - `HomeContent`
  - `AnalyticsEvent`
- Added subscription access fields for content models:
  - `freeTierAccessible`
  - `subscriptionRequired`
  - `requiredSubscriptionTier`
  - `visibility`
- Added role definitions for:
  - `owner`
  - `admin`
  - `coach`
  - `user`
  - `betaTester`
  - `ambassador`
- Added app-owned analytics event contracts for:
  - `user_registered`
  - `subscription_started`
  - `workout_started`
  - `workout_completed`
  - `program_opened`
  - `community_post_created`
- Added `trackAnalyticsEvent(...)`, which writes to the normalized `analyticsEvents` ledger and mirrors into event-specific collections atomically.
- Updated existing Firebase calls in `firebaseConfig.js` to use centralized collection/document constants.
- Updated program access logic so `freeTierAccessible` is honored while preserving existing `subscriptionRequired` behavior.
- Expanded Firestore rules scaffolding for canonical content, admin, moderation, reporting, media, analytics, coach assignment, progress, and workout session collections.

## Data Model Notes

- `appContent/sanctuary` remains the current compatibility path for mobile content.
- Canonical collections like `programs`, `recipes`, `appSettings`, `homeContent`, and `mediaAssets` are documented as the admin-app direction.
- `users/{uid}.role` is intended for app/admin display and filtering.
- Firebase Auth custom claims remain the trusted source for Firestore permission checks.
- Analytics are intentionally app-owned so Google Analytics, Meta, and other tools can be added later without losing our internal event history.

## Security Notes

- Public content-style collections are readable.
- Owner/admin users control canonical content, settings, moderation, subscriptions, and audit/admin areas.
- Users can create their own analytics events, progress/session records, community posts, comments, reports, and media metadata within scoped rules.
- Admin audit logs are append-only from the app rules perspective.

## Validation

```powershell
node -e "const fs=require('fs'); const parser=require('@babel/parser'); for (const file of ['App.js','firebaseConfig.js','firebaseModels.js']) { parser.parse(fs.readFileSync(file,'utf8'), {sourceType:'module', plugins:['jsx']}); console.log(file + ' parsed'); }"
```

Result:

- `App.js parsed`
- `firebaseConfig.js parsed`
- `firebaseModels.js parsed`

## Reviewer Focus

- `firebaseModels.js`: canonical model names, roles, permissions, analytics events, and field contracts.
- `FIREBASE_MODELS.md`: owner/admin-facing model documentation and current compatibility mapping.
- `firestore.rules`: rule scaffolding for the newly modeled collections.
- `firebaseConfig.js`: centralized Firebase constants and analytics writer.
- `App.js`: `freeTierAccessible` program access behavior.
