# November 2 concern implementation

This release implements the approved review of the 20-page concern PDF. The resident app is version 1.0.3 (code 4). The existing lakeside design and Classic certificate template are retained.

## Concern register

| ID | Result |
| --- | --- |
| C01 | Password reset remains account-independent. Error feedback, privacy and resend cooldown improved. Firebase accepted the one authorized test message and the user confirmed mailbox receipt. No password was changed during verification. |
| C02 | Existing atomic collection outcome notices retained and covered by regression tests, including delivery retries. |
| C03 | Meaningful announcement edits create a fresh, unread revision-linked update for the original audience. Retries reuse the notice and cannot widen its recipients. |
| C04 | New collection outcomes offer Active, Completed, Unfinished and Failed. Historical Inactive records remain readable. |
| C05 | Verified minor reports can be resolved by the assigned barangay. Major concerns must be forwarded and reviewed by MENRO before a response action. Actions record the responsible staff, severity, notes, dates and actual milestones. Scheduled response actions reserve a real collection slot and create its notification atomically. |
| C06 | Staff applications, resubmissions and approval use Barangay Captain or Secretary, with server validation and legacy aliases. |
| C07 | Staff signup has an accessible password visibility control. |
| C08 | User Management and staff review display saved contact numbers with existing-profile/request fallbacks. |
| C09 | Dashboard navigation uses User Management. |
| C10 | Existing Philippine date/time restrictions retained. Scheduled report actions also reject past dates/times. |
| C11 | Event detail is divided into Overview, Attendance and Certificates with bounded scrolling. |
| C12 | **Deferred by the user:** their own certificate artwork will be provided later. No replacement design is activated. |
| C13 | My Events separates participation from event lifecycle. Expired/cancelled events never become completed merely because their date passed. Certificate access requires explicit completion and confirmed attendance. |
| C14 | Event editing uses the same category dropdown and validation as creation; unchanged legacy categories remain readable. |
| C15 | Learning resource covers are distinct from original files. Image, PDF, video and supported YouTube previews have source/recovery links. |
| C16 | Project readiness is displayed accurately. The existing Firebase project has TOTP disabled and needs an Identity Platform upgrade. **Activation is left to the project owner as requested.** No upgrade, MFA enrollment or global authentication configuration change was performed. |
| C17 | User-approved Terms and Privacy are available offline during resident registration and at /terms and /privacy. Privacy references RA 10173 and the National Privacy Commission. Opening a document preserves the form and does not toggle consent. No unprovided official email or retention period is invented. |
| C18 | New certificates keep the authoritative full profile name. Read-only diagnosis confirmed the reported old first-name snapshot. MENRO can use Review full name to inspect and explicitly authorize an audited correction; the previous snapshot is retained. No issued production certificate was silently rewritten. |
| C19 | Empty AI chat uses one attachment entry in the persistent composer; preview, removal and scan-to-chat remain available. |
| C20 | Mobile navigation and screen titles use AI Assist. |
| C21 | Reports expose a direct Take a photo action while preserving gallery/video picking, draft restoration, cancellation and attachment limits. |
| C22 | The four report choices use consistent Material pictograms, readable labels and the existing selected state. |
| C23 | Learning collapses to two guides and one video, expands meaningfully, hides unnecessary toggles and keeps search results visible. |
| C24 | Seminar and Other remain selectable even without matching published events. Known category aliases normalize consistently. |

## Data and concurrency

Report actions and announcement edits use stable change IDs and revisions. Stale, revoked, cross-barangay and altered retry requests are rejected. Saves, audit records and notices are atomic. A phone-delivery failure preserves the saved action and exposes pending delivery instead of pretending the save failed. Existing server-only Firestore write rules remain in force; no rule deployment or data migration is required.

Certificate corrections require MENRO access, a recent sign-in, an explicit identity check, and the exact profile name/version that was reviewed. They archive the prior snapshot and audit the exact change while retaining the original event, signatory and issuance details.

## Verification and limits

- Web: all 168 automated tests passed again after compatible dependency patches. Final lint, TypeScript, production build and function bundle checks passed. Three production pages loaded locally and five protected APIs rejected unsigned requests with private, no-store caching.
- Android: 57 unit tests and 34 offline instrumented UI tests passed on the release candidate, including normal and larger text screens.
- Isolated preview: nine dashboard/public routes returned HTTP 200 with synthetic data and no live writes. Interactive browser automation was unavailable because browser use is disabled in the user's settings.
- One authorized reset email was sent and its receipt confirmed by the user. Final password replacement was not performed, so the existing account password was preserved.
- Production report actions, pushes and certificate corrections were not fabricated for testing. Their transaction, authorization, retry and failure paths were tested using local fixtures.
- TOTP end-to-end enrollment/sign-in remains untested until the owner activates the provider. New certificate artwork remains pending the user's file.

## Dependency patch

The release build exposed existing critical Next.js advisories. Next.js and its matching lint configuration were patched from 16.4.0 to 16.4.3, Zod was patched within major version 4, and compatible audit fixes were applied without force. The existing Firebase Admin JWKS compatibility patch is retained and its runtime/signature tests pass. The production audit now reports zero high/critical findings and four moderate findings in the transitive glob/minimatch/rimraf/google-gax chain; those remaining findings are recorded for maintenance. No breaking forced dependency replacements were applied. New lint rules also prompted small cleanup of the dynamically loaded map's unused default-marker initialization and existing image/accessibility/error annotations.

Primary Next.js advisories: [Image optimization](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Server Actions](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), [cached typed arrays](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).

## Release commands

```text
npm run lint
npx tsc --noEmit
node --test --test-concurrency=1 tests/*.test.mjs
npm run build
npm run check:bundle
```

Build, deployment, audit and phone-install evidence is saved in the local November 2 release output directory. Private configuration is excluded from the function bundle and source archives.
