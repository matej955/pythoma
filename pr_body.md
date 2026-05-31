# Move Firebase access behind services

## Summary

This PR pulls Firebase-backed app operations out of `firebaseConfig.js` and behind domain service modules so screens no longer import raw Firebase helper APIs from the bootstrap file.

## What Changed

- Added service modules for auth, programs/content, users, workouts/progress, community chat, and media uploads.
- Reduced `firebaseConfig.js` to Firebase initialization exports only: `app`, `auth`, `db`, `storage`, config status, and Google client IDs.
- Updated `App.js` to call service-layer functions instead of Firebase config helpers.
- Kept the global content cache and manifest flow intact, now routed through `programService`.
- Moved community message paging, realtime new-message subscription, reactions, likes, and sending into `communityService`.
- Moved Storage upload handling into `mediaService`, preserving cancellable uploads for the queue.
- Added a small global chat UX fix so the chat snaps to the newest messages and message input after loading or receiving new messages.
- Updated coworker workflow docs to point new synced-data helpers at `services/*Service.ts`.

## Testing

- Babel transpilation passed for:
  - `App.js`
  - `firebaseConfig.js`
  - all files in `services/`
- Started emulator/build validation, then intentionally cleaned up the interrupted Expo/Gradle processes.

## Reviewer Focus

- `services/*Service.ts`: domain boundaries and Firestore/Storage path ownership.
- `firebaseConfig.js`: bootstrap-only shape.
- `App.js`: changed imports and global chat scroll behavior.
- `docs/coworker-firebase-workflow.md`: updated guidance for future synced data.
