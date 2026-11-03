# November 3 concerns

The report-category chart, GIS filter and analytics exports now use Garbage Overflow, Illegal Dumping, Missed Collection and Other. Legacy Uncollected Waste counts as Garbage Overflow; other obsolete/unknown report labels count as Other without rewriting the saved reports.

Collection analytics and its PDF show Active, Completed, Unfinished and Failed. Saved schedules with retired or unknown statuses remain in the total and are disclosed separately, rather than appearing as extra current outcome categories.

Resident email verification is enforced in authenticatedAccount and in the reviewed Firestore active-account rule. Signup profile creation and owner profile reads remain available to an unverified account, allowing setup/recovery. Staff approval and session rules are unchanged. The policy content pin must be deployed together with the rules.

The companion Android update is 1.0.10 (11). Signup enters a themed verification screen, sends Firebase's verification link, allows retries and refreshed verification checks, then returns to login after verification. Unverified login/restored sessions cannot enter Home. Partial profile setup is retained locally for the same authenticated UID and can be retried without replacing an existing profile. No account passwords or existing verification flags are changed.

The resident inbox filters remote, cached and private notices against Firebase Auth's account creation time. That cutoff is account-specific, cannot be changed through profile editing, survives reinstall/signout, and does not clear existing notification records. Unverified users do not start inbox listeners or phone topic subscriptions.

Both collection filter UIs omit Inactive. The report form retains its direct Take a photo action; the media tile opens the system photo/video picker directly, removing the redundant camera-source dialog while retaining capture, draft restoration, cancellation and attachment limits.

Validation uses synthetic accounts/records and offline UI fixtures. No real verification emails are sent by the test suite, so mailbox arrival is not claimed. Firebase handles the hosted verification link. Browser capture is unavailable because local browser use is disabled; web verification includes regression tests, lint, TypeScript, production build and bundle checks. Native screens are captured on the emulator.

The local release package, native source snapshot, APK, screenshots, test results, policy rollback source and deployment checks are stored in output/nov3-concerns-release at the workspace root.
