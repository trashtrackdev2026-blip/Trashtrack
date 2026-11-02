# November 2 follow-up implementation

This release implements the approved follow-up concern plan while retaining the existing Balete theme: forest green, cream surfaces, rounded controls, Outfit headings, and real local photography. Android is 1.0.6 (code 7).

The user subsequently said password reset is okay and to leave it. The web and Android reset pages, reset handlers, and email-delivery configuration are unchanged. No reset message or password replacement was performed. Authentication Back navigation is fixed separately.

## Concern register

| ID | Source pages | Result |
| --- | --- | --- |
| A01 | 1-2 | MENRO can correct future collection date/time/barangay/notes through a transactional editor. Day derives from date. Slot conflicts and elapsed Philippine times are rejected; notices cover old/new audiences and open linked report actions follow the schedule. Failed/unfinished collections can get linked future follow-ups while retaining the original outcome. |
| A02 | 1-2 | Completed collections are read-only. Outcome, edit, follow-up and delete APIs enforce the lock; replay of an already committed request remains safe. Direct client schedule writes are denied by the reviewed policy. |
| A03 | 2 | Barangay registration uses the existing admin mark, approved real Balete photo, green/cream palette, Outfit type, responsive fields and rounded form. Existing position, contact, email verification, pending approval and partial-submit recovery remain. |
| A04 | 3 | MENRO response planning offers Posted collection or New collection. The server validates the chosen ID, revision, barangay, active state and future time, deriving action date/time from the selected record. |
| A05 | 3 | Barangay findings are validated with explicit guidance and retained as verification notes and audited action findings. Minor resolution and major referral remain scoped to the assigned barangay. |
| A06 | 3-4 | Successful saves close report details so the next action opens a fresh revision. Real conflicts have a review-latest action with draft notes preserved. Legacy status spelling is normalized without disabling revision checks. |
| A07 | 4 | Completed event badge has an explicit dark-on-light pairing that overrides the dark-panel text rule. |
| A08 | 5 | Learning deletion uses an app dialog with title, effect, cancel, busy and retry states. It removes the listing; unrelated hosted files remain untouched. |
| A09 | 5-6 | Schedule deletion uses the same themed dialog and server transaction. Completed and report-linked collections cannot be deleted. Allowed removals create cancellation notices and retain an audit record. |
| A10 | 6 | Left unchanged at the user's subsequent request. No recovery redesign or new delivery test. |
| A11 | 7 | Today's collections uses the approved cleaned real Balete photo. The list remains driven by actual records. |
| A12 | 7 | MENRO settings replaces inline password replacement with a link to the existing recovery page. Other recent-sign-in protections remain. No reset request is sent automatically. |
| A13 | 7-8 | Canonical notification categories handle known legacy aliases, include Report, retain unknown types under All, combine with other filters and clamp pagination. Clear-filter empty state is provided. |
| A14 | 8 | Delivery-filter labels map every state correctly. Open notification details follow the live record instead of a frozen copy. Existing transactional delivery/retry logic remains; service acceptance is never represented as a read receipt. |
| A15 | 8 | New certificate layout v3 puts the officer name above the supplied line and position below. Existing v2 and earlier issued snapshots retain their original layout/artwork. No fake signature is added. |
| A16 | 9 | Actual current admin mark (public/images/trashtrack-mark.webp) supplies native in-app, adaptive/round launcher and Android 12 splash assets. Cream launch background and dark-mode handling match the app. |
| A17 | 10 | Learning cards use actual images, PDF first pages or provider video frames/thumbnails. Neutral document/video tiles replace decorative fallback pictures. PDF uploads support image-derived previews, original file URLs stay separate, and a real cover can be uploaded. Raw legacy PDFs render their first page natively in Android. |
| A18 | 10-11 | Login, registration and recovery Back actions have deterministic fallbacks when logout/root navigation leaves no previous entry. System Back matches toolbar behavior. |
| A19 | 11-12 | Left unchanged at the user's subsequent request. No new resident reset email or credential change. |
| A20 | 12-13 | Help & Support includes a text-only Bug/Suggestion/Other form, saved draft, retry-safe submission and receipt. MENRO has a private paginated inbox, new count, search within page and Reviewed/Closed states. |

## Data, authorization and retries

Collection edits, deletions and follow-ups check authenticated MENRO access, active account, current revision, terminal state, duplicate dates and report linkage inside the transaction. Old and new schedule-day locks coordinate with report action selection. Schedule changes update unresolved linked report dates and retain their original planning fields. Resolved reports remain historical. Collection completion does not automatically resolve a report.

Feedback uses server-assigned profile identity, barangay, timestamp and review state. Residents can retrieve only their own receipt/status through the API; MENRO can list/review; barangay staff and other residents are denied. Direct Firestore access is denied. Stable submission IDs deduplicate lost responses; per-account throttles limit repeated submissions. Review transitions update private status views atomically with the canonical record. These indexed single-field views provide ordered status pagination without a composite index or owner-only index permission. No production feedback was fabricated for testing.

The reviewed policy is versioned in security/firestore.rules and mirrored to the root project rules. The prior live policy allowed direct schedule writes; the new policy restricts them to the APIs and retains the existing resident profile/barangay edit permission. Resident report submission already uses the authenticated geofence API, so direct report creation is denied. All existing staff claims, session age, active-account and MFA conditions remain. Production staff/certificate guards verify the exact reviewed policy content hash (normalizing line endings), instead of trusting a previous ruleset UUID. Unreviewed rule content fails closed even if it reuses that UUID. Other project configurations retain UUID pinning.

No Identity Platform upgrade, authenticator activation, bulk media migration, issued-certificate rewrite or account password change is included.

## Validation and practical limits

- Web: 183 regression tests, lint, TypeScript, production build and bundle checks. API fixtures include selected schedule validity, reschedules, duplicate slots, terminal locks, revoked access, role/scope checks, feedback privacy/throttles/retries and policy-content pinning.
- Android: 59 unit tests and 15 isolated UI tests, including new root auth Back paths, feedback states, larger text and actual PDF first-page rendering. Seven new UI cases were repeated after dismissing an emulator System UI overlay; screenshots were recaptured and inspected unobstructed. Tests create no live resident data or emails.
- Browser: isolated sample preview of responsive staff registration, collection editor/cancel and MENRO feedback detail. Screenshots use synthetic records with live writes blocked. Browser use was subsequently disabled in Work settings; remaining browser interactions were not bypassed.
- Certificates: normal, long-field and historical-v2 PDFs generated from synthetic names and visually inspected. Existing artwork is unchanged. New officer text sits above the line.
- Learning: legacy raw PDFs do not get a new hosted thumbnail automatically. Android renders their first page using its bounded document cache. Unsupported or blocked provider previews use a neutral tile; MENRO can upload a real cover.
- Recovery: unchanged and untested again, per the user's instruction.

Release evidence, screenshots, policy rollback source and APK are stored locally under output/nov2-followup-release. Deployment and physical-phone installation are verified separately and recorded there.

## Release coordination

Deploy the web revision, then activate the prepared policy immediately and verify services and content hash. The new server guard intentionally refuses the old policy until activation. No private hosting variable or credential is committed. The previous ruleset and source are retained for rollback; code and policy must roll back together. Install Android with adb install -r, preserving physical-phone data.
