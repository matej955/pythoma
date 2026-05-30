# Firebase Models

This file is the working source of truth for Firestore collections and document shapes. Keep collection names in `firebaseModels.js` and import them from there instead of adding string literals in feature code.

## Model Version

- `FIREBASE_MODEL_VERSION`: `2`
- App content root: `appContent/sanctuary`
- User profile document: `users/{uid}/profile/main`
- User progress documents: `users/{uid}/progress/{programId}`
- Global chat messages today: `communityMessages/{messageId}`

## Canonical Collections

These are the collections to build around for the app and future owner/admin web app.

| Model | Collection | Purpose |
| --- | --- | --- |
| User | `users` | Auth-linked user root records, roles, status, subscription summary. |
| Workout | `workouts` | Workout definitions that can belong to programs. |
| Program | `programs` | Program definitions, subscription gating, ordering, publishing state. |
| Exercise | `exercises` | Reusable exercise library with instructions, media, equipment, and muscle groups. |
| Recipe | `recipes` | Wellness drinks/recipes currently shown as potions in the app. |
| Subscription | `subscriptions` | Global subscription and entitlement records. |
| Progress | `progress` | Canonical progress records for admin/reporting; current app also stores per-user progress below `users`. |
| WorkoutSession | `workoutSessions` | Workout start/completion history behind analytics and progress. |
| CommunityPost | `communityPosts` | Canonical community/feed posts for moderation and admin review. |
| Comment | `comments` | Comments against posts, with moderation and reactions. |
| Notification | `notifications` | User-facing app notifications and deep links. |
| MediaAsset | `mediaAssets` | Uploaded/admin-managed media metadata. |
| Report | `reports` | User-created reports against community, media, comments, or users. |
| ModerationAction | `moderationActions` | Owner/admin moderation history. |
| CoachAssignment | `coachAssignments` | Coach-to-user relationship records. |
| AdminAuditLog | `adminAuditLogs` | Owner/admin change history for sensitive operations. |
| AppSettings | `appSettings` | Admin-editable app settings and feature configuration. |
| AppNavigation | `appNavigation` | Admin-editable navigation items. |
| HomeContent | `homeContent` | Admin-editable home screen content. |
| AnalyticsEvent | `analyticsEvents` | App-owned analytics ledger for product and business analysis. |

## Access Fields

Subscription-aware content should use these fields consistently:

| Field | Type | Purpose |
| --- | --- | --- |
| `freeTierAccessible` | `boolean` | Direct owner/admin marker for whether free users can open the item. |
| `subscriptionRequired` | `boolean` | Compatibility gate for existing app data and older content records. |
| `requiredSubscriptionTier` | `string` | Optional plan/tier needed when content is not free. |
| `visibility` | `public \| authenticated \| subscriber \| ownerOnly` | High-level audience control for app/admin filtering. |

For new content, `freeTierAccessible` should be the primary admin-facing toggle. Keep `subscriptionRequired` during the migration so older mobile clients and existing content continue to behave correctly.

## Roles And Permissions

Roles live on `users/{uid}.role` for app/admin display and filtering. Firestore rules should rely on Firebase Auth custom claims for trusted security decisions.

| Role ID | Name | Scope | Permissions |
| --- | --- | --- | --- |
| `owner` | Owner | Full business and platform control. | `manage:allContent`, `manage:programs`, `manage:workouts`, `manage:exercises`, `manage:recipes`, `manage:users`, `manage:subscriptions`, `manage:media`, `manage:appSettings`, `moderate:community`, `review:reports`, `view:adminDashboard`, `view:auditLogs`, `use:app` |
| `admin` | Admin | Operational admin for content, community, users, and subscriptions. | `manage:programs`, `manage:workouts`, `manage:exercises`, `manage:recipes`, `manage:users`, `manage:subscriptions`, `manage:media`, `manage:appSettings`, `moderate:community`, `review:reports`, `view:adminDashboard`, `view:auditLogs`, `use:app` |
| `coach` | Coach | Coaching access for assigned users and progress review. | `view:assignedUsers`, `manage:assignedProgress`, `create:communityPosts`, `create:reports`, `use:app` |
| `user` | User | Standard app user with subscription-based content access. | `create:communityPosts`, `create:reports`, `use:app` |
| `betaTester` | Beta Tester | Standard user plus early feature access and feedback. | `create:communityPosts`, `create:reports`, `access:betaFeatures`, `submit:betaFeedback`, `use:app` |
| `ambassador` | Ambassador | Community-facing user who can publish ambassador content. | `create:communityPosts`, `create:ambassadorPosts`, `create:reports`, `use:app` |

Custom claim names should match the role IDs where practical: `owner`, `admin`, `coach`, `user`, `betaTester`, `ambassador`.

## Analytics Events

App-owned analytics should be written to `analyticsEvents` as the normalized event ledger and mirrored into the event-specific collection for simpler owner/admin queries.

| Event | Event Collection | Scope | Primary Data |
| --- | --- | --- | --- |
| `user_registered` | `analyticsUserRegisteredEvents` | Auth | `registrationMethod`, `role`, `subscriptionTier` |
| `subscription_started` | `analyticsSubscriptionStartedEvents` | Subscription | `subscriptionId`, `provider`, `tier`, `plan`, `price`, `currency` |
| `workout_started` | `analyticsWorkoutStartedEvents` | Training | `workoutId`, `programId`, `week`, `day` |
| `workout_completed` | `analyticsWorkoutCompletedEvents` | Training | `workoutId`, `programId`, `durationSeconds`, `completionPercent` |
| `program_opened` | `analyticsProgramOpenedEvents` | Content | `programId`, `programTitle`, `freeTierAccessible`, `subscriptionRequired`, `requiredSubscriptionTier` |
| `community_post_created` | `analyticsCommunityPostCreatedEvents` | Community | `postId`, `contentType`, `attachmentCount`, `hasText` |

Shared analytics fields: `eventName`, `uid`, `email`, `role`, `sessionId`, `anonymousId`, `source`, `platform`, `appVersion`, `occurredAt`, `createdAt`, `context`, `data`.

The app helper should write one document to `analyticsEvents` and one mirror document to the event-specific collection. Google Analytics, Meta, or other tools can receive the same event names later, but Firestore remains the owner-controlled source for deeper internal analysis.

## Content And Admin Structure

Current mobile content still reads from `appContent/sanctuary` and its subcollections. The canonical collections below are the owner/admin direction for future editing, migrations, and clearer permissions:

| Current Path | Canonical Model | Notes |
| --- | --- | --- |
| `appContent/sanctuary/programs/{programId}` | `programs` | Program definitions should eventually live in `programs`. |
| `appContent/sanctuary/potions/{recipeId}` | `recipes` | The app label can remain potion/drink, but the data model should use `Recipe`. |
| `appContent/sanctuary/settings/main` | `appSettings`, `homeContent` | Split broad settings into focused admin pages later. |
| `appContent/sanctuary/navItems/{navItemId}` | `appNavigation` | Navigation is content-managed, not hard-coded app logic. |
| `appContent/sanctuary/images/{imageId}` | `mediaAssets` | Image URLs should eventually be media records with usage metadata. |
| `communityMessages/{messageId}.attachments[]` | `CommunityAttachment` | Embedded union shape for `image`, `recipe`, `progress`, and future `program` shares. |

Use `AdminAuditLog` for owner/admin mutations to content, subscriptions, users, moderation, settings, and roles. Use `ModerationAction` for community-specific review actions.

## Current Live Collections

These collections are already used by the app and rules. They should be treated as compatibility paths until we migrate or intentionally keep them.

| Path | Used For |
| --- | --- |
| `appContent/sanctuary` | Main app content, settings, images, nav items, program content, community reaction settings. |
| `communityMessages/{messageId}` | Current global chat posts, recipe shares, program progress shares, reaction counts. |
| `communityMessages/{messageId}/reactions/{uid}` | One reaction per user per message, with aggregate counts on the message. |
| `communityMessages/{messageId}/likes/{uid}` | Legacy likes path. Prefer reactions for new UI. |
| `users/{uid}` | User root profile/subscription fallback data. |
| `users/{uid}/profile/main` | Editable user profile used by the mobile app. |
| `users/{uid}/progress/{programId}` | Current per-user program progress. |
| `userPrograms/{userProgramId}` | Active user program assignments used for sharing progress. |
| `subscriptions/{subscriptionId}` | Subscription lookup by uid/email/id. |
| `userSubscriptions/{subscriptionId}` | Per-user subscription mirror lookup. |
| `profiles/{uid}` | Legacy subscription/profile lookup fallback. |
| `appContent/sanctuary/settings/main` | Current settings, home content, profile stats, upload modes, reactions, and discounts. |
| `appContent/sanctuary/images/{imageId}` | Current image URL map. |
| `appContent/sanctuary/potions/{recipeId}` | Current wellness recipe/drink catalog. |
| `appContent/sanctuary/navItems/{navItemId}` | Current app navigation config. |
| `appContent/sanctuary/communityPosts/{postId}` | Current seeded non-chat community cards. |
| `mediaAssets/{mediaAssetId}` | Uploaded/admin-managed media metadata. |
| `reports/{reportId}` | User-created moderation reports. |
| `moderationActions/{moderationActionId}` | Owner/admin moderation history. |
| `workoutSessions/{workoutSessionId}` | Workout start/completion history. |
| `coachAssignments/{coachAssignmentId}` | Coach-to-user assignment records. |
| `adminAuditLogs/{adminAuditLogId}` | Owner/admin change history. |
| `analyticsEvents/{eventId}` | Normalized owner analytics event ledger. |
| `analyticsUserRegisteredEvents/{eventId}` | Event-specific `user_registered` analytics. |
| `analyticsSubscriptionStartedEvents/{eventId}` | Event-specific `subscription_started` analytics. |
| `analyticsWorkoutStartedEvents/{eventId}` | Event-specific `workout_started` analytics. |
| `analyticsWorkoutCompletedEvents/{eventId}` | Event-specific `workout_completed` analytics. |
| `analyticsProgramOpenedEvents/{eventId}` | Event-specific `program_opened` analytics. |
| `analyticsCommunityPostCreatedEvents/{eventId}` | Event-specific `community_post_created` analytics. |

## Required Models

### User

Collection: `users`

Fields: `uid`, `email`, `displayName`, `photoURL`, `role`, `permissions`, `status`, `subscriptionTier`, `createdAt`, `updatedAt`.

Subcollections: `profile`, `progress`.

### Workout

Collection: `workouts`

Fields: `title`, `description`, `programId`, `week`, `day`, `order`, `exerciseIds`, `estimatedMinutes`, `freeTierAccessible`, `subscriptionRequired`, `requiredSubscriptionTier`, `visibility`, `status`, `createdAt`, `updatedAt`.

### Program

Collection: `programs`

Fields: `title`, `category`, `weeks`, `level`, `description`, `image`, `workoutIds`, `freeTierAccessible`, `subscriptionRequired`, `requiredSubscriptionTier`, `visibility`, `status`, `order`, `createdAt`, `updatedAt`.

Current compatibility paths: `appContent/sanctuary/programs/{programId}`, `userPrograms/{userProgramId}`.

### Exercise

Collection: `exercises`

Fields: `title`, `description`, `videoUrl`, `image`, `muscleGroups`, `equipment`, `instructions`, `cues`, `freeTierAccessible`, `subscriptionRequired`, `requiredSubscriptionTier`, `visibility`, `status`, `createdAt`, `updatedAt`.

### Recipe

Collection: `recipes`

Fields: `title`, `category`, `tab`, `image`, `timing`, `ingredients`, `preparation`, `benefits`, `freeTierAccessible`, `subscriptionRequired`, `requiredSubscriptionTier`, `visibility`, `status`, `order`, `createdAt`, `updatedAt`.

Current compatibility path: `appContent/sanctuary/potions/{recipeId}`.

### Subscription

Collection: `subscriptions`

Fields: `uid`, `email`, `provider`, `providerSubscriptionId`, `status`, `active`, `tier`, `plan`, `startsAt`, `endsAt`, `createdAt`, `updatedAt`.

Compatibility mirror: `userSubscriptions`.

### Progress

Collection: `progress`

Fields: `uid`, `programId`, `workoutId`, `percent`, `completedWorkouts`, `totalWorkouts`, `lastCompletedAt`, `createdAt`, `updatedAt`.

Current app path: `users/{uid}/progress/{programId}`.

### WorkoutSession

Collection: `workoutSessions`

Fields: `uid`, `programId`, `workoutId`, `status`, `startedAt`, `completedAt`, `durationSeconds`, `completionPercent`, `source`, `createdAt`, `updatedAt`.

### CommunityPost

Collection: `communityPosts`

Fields: `uid`, `name`, `email`, `text`, `attachments`, `visibility`, `moderationStatus`, `reviewStatus`, `reportCount`, `reactionCounts`, `createdAt`, `updatedAt`.

Current app path: `communityMessages/{messageId}`.

Embedded attachment fields: `id`, `type`, `title`, `image`, `url`, `storagePath`, `recipeId`, `programId`, `progressPercent`, `userName`, `meta`.

### Comment

Collection: `comments`

Fields: `postId`, `parentCommentId`, `uid`, `name`, `text`, `visibility`, `moderationStatus`, `reactionCounts`, `createdAt`, `updatedAt`.

### Notification

Collection: `notifications`

Fields: `uid`, `type`, `title`, `body`, `deepLink`, `read`, `createdAt`, `readAt`.

### MediaAsset

Collection: `mediaAssets`

Fields: `uid`, `url`, `storagePath`, `fileName`, `contentType`, `sizeBytes`, `usage`, `ownerType`, `linkedCollection`, `linkedDocumentId`, `visibility`, `moderationStatus`, `createdAt`, `updatedAt`.

### Report

Collection: `reports`

Fields: `reporterUid`, `targetType`, `targetId`, `targetOwnerUid`, `reason`, `details`, `status`, `resolution`, `createdAt`, `updatedAt`.

### ModerationAction

Collection: `moderationActions`

Fields: `moderatorUid`, `targetType`, `targetId`, `action`, `reason`, `previousState`, `nextState`, `reportId`, `createdAt`.

### CoachAssignment

Collection: `coachAssignments`

Fields: `coachUid`, `userUid`, `status`, `assignedAt`, `endedAt`, `notes`, `createdAt`, `updatedAt`.

### AdminAuditLog

Collection: `adminAuditLogs`

Fields: `actorUid`, `actorRole`, `action`, `targetCollection`, `targetId`, `before`, `after`, `reason`, `createdAt`.

### AppSettings

Collection: `appSettings`

Fields: `trainingTabs`, `communityTabs`, `communityReactions`, `uploadModes`, `profileStats`, `brandDiscount`, `cache`, `status`, `createdAt`, `updatedAt`.

Current compatibility path: `appContent/sanctuary/settings/main`.

### AppNavigation

Collection: `appNavigation`

Fields: `key`, `label`, `icon`, `screen`, `order`, `visibility`, `status`, `createdAt`, `updatedAt`.

Current compatibility path: `appContent/sanctuary/navItems/{navItemId}`.

### HomeContent

Collection: `homeContent`

Fields: `dailyFocus`, `todayTasks`, `dailyBoard`, `quickActions`, `status`, `createdAt`, `updatedAt`.

### AnalyticsEvent

Collection: `analyticsEvents`

Fields: `eventName`, `uid`, `email`, `role`, `sessionId`, `anonymousId`, `source`, `platform`, `appVersion`, `occurredAt`, `createdAt`, `context`, `data`.

Event-specific mirrors: `analyticsUserRegisteredEvents`, `analyticsSubscriptionStartedEvents`, `analyticsWorkoutStartedEvents`, `analyticsWorkoutCompletedEvents`, `analyticsProgramOpenedEvents`, `analyticsCommunityPostCreatedEvents`.

## Admin App Notes

- Owner/admin tooling should read from canonical collections where available and keep compatibility reads for current mobile data.
- Moderation fields should use the same vocabulary across posts and comments: `visible`, `hidden`, `removed`, `blocked`, `pendingReview`, `approved`.
- Subscription-gated content should expose `freeTierAccessible` as the owner/admin toggle, while keeping `subscriptionRequired` and `requiredSubscriptionTier` for compatibility and tier-specific gates.
- Reactions are stored per user and aggregated onto the post/message document as `reactionCounts`.
- Analytics collections are append-oriented. Owners/admins can read and correct them, but app users should only create their own event documents.
