# Notification and interface fixes — 27 October 2026

## Changes

- Notification creation now uses an authenticated server endpoint, a stable
  request ID and a transaction. Retrying a lost response reuses the same saved
  inbox record. Phone failure leaves that record available with a visible retry
  status. The admin history resumes eligible pending/transient failures while
  open and when internet returns; manual retry remains available. The header
  badge now shows actual pending/failed delivery counts instead of a fixed 5.
- FCM uses high-priority data messages with all display fields and independent
  notification IDs. This avoids the implicit replacement of undelivered
  notification messages described in [Firebase's delivery documentation](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types).
  Each received message is cached locally and displayed in the tray. Repeated
  delivery with the same ID/content does not post another alert.
- Subscription reconciliation waits for the restored profile instead of
  unsubscribing the phone while the profile is still loading. Profile and topic
  failures retry. Notification-channel blocking is detected.
- Home and Notifications share one account-scoped inbox and read state.
  The inbox displays synchronization errors and retries rather than silently
  becoming empty. Push receipts bridge an offline/delayed Firestore snapshot;
  once a notice is synchronized, Firestore owns updates and deletion. Local
  fallback receipts expire after seven days and are limited to 100 items.
- Schedule notes load from `description`, with legacy `notes` supported, and
  appear on Home, the full collection schedule and the admin schedule list.
  Line breaks and full instructions are retained.
- The chatbot consumes its parent navigation insets and pads for the keyboard.
  Input can grow to four lines; the send button and typed text stay visible.
- Report maps keep one-finger drags inside the map. Tap-to-place and 48 dp zoom
  buttons are available; duplicate native zoom controls are hidden.
- Notification confirmation/detail dialogs use an accessible portal above the
  dashboard header. Their height is bounded by the viewport and scrolls when
  needed. The confirmation fits at 1366×585 and 390×585.

The municipality-supplied geofencing corrections from the previous task remain
included in both dashboards and the APK.

## Verification

- All 106 web tests pass; TypeScript and targeted ESLint have zero errors.
- The configured dashboard production build and function bundle check pass.
  Next.js continues to report its existing dependency security-upgrade advisory;
  dependency upgrades are outside this notification/interface change.
- All 30 Android unit tests pass; debug and test APKs build successfully.
- On the connected Samsung SM-A346E running Android 16: keyboard/input bounds,
  visible collection notes, vertical one-finger map dragging, zoom buttons,
  local tray delivery and notification tap behavior passed.
- Real Firebase messages were sent only to the connected phone's registration
  token: two distinct messages plus a duplicate retry. Both reached the tray and
  in-app inbox; the retry did not create another alert. No resident topic message
  or shared Firestore test announcement was created.
- The automated Gradle test runner cleaned up its test installation. The final
  app was subsequently installed directly and left installed; the resident
  signed in again for the live test. The final update used `adb install -r`.
- The phone's Do Not Disturb setting was enabled (`zen_mode=1`) and left unchanged.
  Android can suppress notification sounds/banners under DND even when delivery
  succeeds; see [Android notification behavior](https://developer.android.com/develop/ui/compose/notifications).

## Artifacts and rollout

- `output/TrashTrack-notifications-ui-debug.apk`: final Android build, also
  installed on the connected phone.
- `output/TrashTrack-admin-vercel-ready.zip`: updated dashboard/server source,
  including the notification creation endpoint and municipal boundaries.
- Proof screenshots: `output/admin-notification-dialog-fixed.png`,
  `output/chat-keyboard-fixed.png`, `output/collection-notes-fixed.png`,
  `output/map-one-finger-controls.png`, `output/phone-fcm-inbox-verified.png`.
- Test/build logs: `tmp/notifications-ui-*.log`.
- Source baseline: `tmp/notifications-ui-baseline/`.

The dashboard/backend must be deployed with this APK rollout to activate the
new server publishing and payload changes. No production dashboard deployment
was performed. Android permission/channel settings, connectivity, DND and
force-stop state still determine whether the OS displays an alert immediately.
