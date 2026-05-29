# Firebase Data Model

This app keeps a small fallback bundle on the device, then uses Firebase for content, community data, and per-user sync.

## Global App Content

Global content is public, cache-first, and updated by admin tooling only.

```text
appContent/sanctuary
appContent/sanctuary/settings/main
appContent/sanctuary/images/{imageKey}
appContent/sanctuary/programs/{programId}
appContent/sanctuary/potions/{potionId}
appContent/sanctuary/navItems/{navKey}
appContent/sanctuary/communityPosts/{postId}
```

The root document is a lightweight manifest. The app checks `contentVersion` and cache policy before downloading subcollections.

Use `contentType` on every content document so future additions can be routed clearly as `settings`, `programs`, `potions`, `images`, or another app-content section.

## User Data

Private user data belongs under the user UID.

```text
users/{uid}
users/{uid}/profile/main
users/{uid}/progress/{programId}
users/{uid}/preferences/main
users/{uid}/savedContent/{contentId}
```

The app should write here as the signed-in user. Keep these documents small and specific so future screens can subscribe or fetch only what they need.

## Live Community Data

Community chat and reactions are separate from global app content.

```text
communityMessages/{messageId}
communityMessages/{messageId}/likes/{uid}
```

Use live listeners for chat-like data. Do not use live listeners for mostly static global content unless a screen truly needs real-time changes.

## Media

Store large media in Firebase Storage or external image hosting. Firestore should store URLs, storage paths, metadata, and thumbnail references only.

## Cache Policy

The bundled fallback keeps the app usable offline. Cached app content lasts 5 days by default. On app open:

1. Load valid cached content immediately.
2. Fetch the small `appContent/sanctuary` manifest.
3. If `contentVersion` matches cache, stop.
4. If changed or expired, fetch the modeled content sections and refresh cache.
