# Android phone alerts

The in-app history is synced from Firestore. Seeing a history entry does not establish that a phone received an FCM alert. `Sent to phone service` means Firebase accepted the message.

Public community pushes now include both `notification` and `data` payloads. Firebase displays the notification while the app is in the background; the existing Android messaging service handles foreground display. Both paths use the `trashtrack_updates` channel and `trashtrack:<notificationId>` tag. A retry uses the same tag. Notification taps retain the existing inbox navigation fields.

The Android update also exposes phone-alert connection status, **Reconnect phone alerts**, and **Test phone alert** under Profile → Settings. Granting permission there immediately refreshes subscriptions. Connection failures and slow registrations are visible rather than appearing successful. Account changes invalidate pending callbacks from the prior account. Tapping a background alert preserves its data in the local inbox when a signed-in account is available.

The test-alert button checks Android display permission/channel behavior; it does not claim to test remote FCM delivery. Topic registration is limited to signed-in residents who allow notifications, using their barangay plus municipal announcements.

Validation for the October 31 fix:

- Existing sender check: the latest ten delivery-status records were queued without recorded errors. The check read delivery metadata only, not message bodies or user profiles.
- Revised visible payload passed Firebase Admin's dry-run validation.
- Real token-targeted FCM alerts reached a local Android emulator in foreground and normal background use. Background verification read Android's notification records directly; foreground verification checked the messaging service's display receipt. No resident topic or Firestore record was used for these test sends.
- 133 web tests, TypeScript checking and changed-file lint passed. The production web build passed.

Android permission, channel settings, internet/Google Play services and force-stop behavior still apply. Background notification messages can be consolidated by FCM while a device is offline; Firestore remains the full in-app history. Do not re-send old community announcements merely to test delivery. Use the local test action or a device-specific diagnostic token.

See Firebase's [Android message routing](https://firebase.google.com/docs/cloud-messaging/android/receive-messages) and [notification permission requirements](https://firebase.google.com/docs/cloud-messaging/android/get-started#request_runtime_notification_permission_on_android_13).
