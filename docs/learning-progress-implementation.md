# Learning materials and resident report progress - November 2, 2026

The two-page Learning Materials concern PDF and the report Action details screenshot were checked against the current dashboard and Android source. Existing green/cream surfaces, Outfit typography, rounded controls and Balete photography are retained.

## Learning materials

- The cover upload control was redesigned in 1.0.7 with Browse files, an upload icon, preview and removal. That implementation is retained.
- Publishing and filtering already support Waste Segregation, Composting, Recycling and Environmental Awareness. Android reading materials include Articles regardless of category; the existing Article regression checks are repeated for this release.
- The resource edit form used a free-text category field, which looked like a single fixed choice. It now offers all four supported categories, retains an existing legacy value, and lets MENRO edit the saved description/content. Editing closes the previous reader before opening the edit dialog so modal focus does not compete.
- Optional descriptions are now visible under About this material for attached guides, PDFs, images and videos, with Read more/Show less. Written Articles still display their content directly. A file/link can stand alone; an Article without a source requires its written content. Editing cannot erase the only content of a written Article.

## Report details and progress

The resident's Description is the original report. Staff Action details are saved separately as actionNotes and displayed in Response plan. Final MENRO action details use the required resolution remarks and are shown in Resolution details. The reader preserves the planned action after resolution and reads resolutionNotes explicitly, with legacy remarks as a fallback.

Each successful report status transition now commits all of the following in one transaction:

1. The updated report stage, revision and actual action details.
2. A history entry with server time, actor role, action details and findings.
3. One private resident notice attributed to the report's saved userId, never to a client-supplied recipient.
4. The existing staff audit and idempotent operation record.

Stages include barangay review, forwarding, MENRO review, response planning and both barangay/MENRO resolution. Repeating the same operation resumes delivery without duplicating the report update or inbox notice. Failed provider calls do not roll back the report or lose its notice. Existing collection announcements retain their public barangay audience.

Private report notices are stored separately from municipal announcements. Firestore permits only their owner to read them and denies client writes. Phone registration is authenticated and server-owned; no token values appear in logs or artifacts. Direct device pushes use data messages, and Android verifies the signed-in recipient before showing or caching them. Another account or a signed-out phone cannot display that recipient's report payload. Suspended/deleted/non-resident owners are excluded from delivery. Shared-device registration is reconciled on sign-in/resume and retry.

The resident inbox merges private report updates with public announcements while preserving account-scoped read state. Selecting a private progress notice opens that resident's actual report. Full notes remain in the inbox/report; the phone tray uses a bounded excerpt. Device registration and pending delivery resume when the updated app reconnects. Android notification permission and network/Google Play delivery remain necessary for phone alerts.

New history/notices start with future saved actions. Existing action/resolution fields remain readable without inventing past activity or generating retrospective notices.

## Release checks

- Web: 201 tests pass, including actual transactional report routes for all transitions, private recipient enforcement, retries, final resolution notes, unchanged original description, provider failures, device registration, cross-owner device isolation, invalid tokens and suspended recipients.
- Android: 62 unit tests pass, including cross-account and signed-out notification filtering. Nine targeted native UI checks pass, plus a clean three-test visual rerun after dismissing an emulator System UI overlay. The resolution screen shows both the saved response plan and final notes without replacing the original description; descriptions and private progress navigation were also inspected. Android 1.0.8, version code 9, builds successfully.
- Browser interaction is disabled in Work settings. Dashboard click-through is not claimed as tested; TypeScript, lint, production build and code review cover those changes.
- The private-inbox policy is compiled before deployment and activated with the matching code content pin. Existing permissions stay intact; push token records remain inaccessible to client Firestore reads/writes.
- No production reports, fake progress notices, test emails or learning duplicates are created by verification. Password reset, account passwords, authenticator activation and certificates are unchanged.
