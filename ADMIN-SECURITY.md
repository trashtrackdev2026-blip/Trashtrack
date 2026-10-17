# Staff access in TrashTrack

Use the same sign-in page for MENRO Master Admin and barangay staff. The stored role names remain `Admin` and `Semi-Admin` for compatibility.

1. Officials open `/signup`, enter their official email, name, official position, contact and one of the 13 barangays, and choose a password of at least 12 characters.
2. Registration saves the resident profile and pending staff request together on the server, then sends a verification email. A failed request can be retried without creating another login account or duplicating the pending request.
3. The request appears immediately in MENRO's pending list as awaiting verification. Firebase Auth supplies the current verification status; the official does not need to submit another form after verifying. Pending applicants receive no staff privileges. The list refreshes every 30 seconds while visible and when MENRO returns to the page.
4. MENRO opens **User Management → Staff access**, confirms the official position, verifies the official's identity and authority, and chooses **Admin** or **Semi-Admin**. Approval checks email verification on the server. Admin receives full MENRO access, including staff approvals. Semi-Admin must be assigned one of the 13 barangays.
5. The official signs in again to use the approved permissions. Semi-Admins can review and forward only reports from their assigned barangay. MENRO endorses collection and confirms collection before resolution.

MENRO can reject requests, change active staff roles or barangay assignments, suspend staff, or reactivate them. Changing access requires sign-in within the last five minutes. If confirmation is needed, a dialog accepts the current MENRO password and any required authenticator code, refreshes the session, and continues the saved action once. The administrator stays signed in and keeps the selected role, barangay and official position. Canceling or entering an incorrect password/code does not submit the action. Approval errors stay beside the review buttons and are not cleared by background list refreshes. Accounts cannot change their own access. The last active MENRO Admin cannot be demoted or suspended. Role changes invalidate old sessions and are audited. An invalid legacy barangay account must verify its email and request a corrected assignment; it is never silently reassigned. Public signup cannot create MENRO Master Admins; only an authenticated MENRO Admin can approve that access.

For older registrations that created a login but never submitted an access request, MENRO can use **Find a missing registration**, enter the registered email, complete the official details, and select **Add to pending requests**. This requires verified email and recent MENRO sign-in, records an audit entry, and grants no access. The separate review and approval step remains required. Officials can also sign in at `/staff-account` and submit the missing request themselves. Ordinary resident accounts are not automatically listed as staff applicants.

## Active safeguards

Semi-Admins have **Community Reports** and **Reports to MENRO**. Begin reviewing a pending report in Community Reports, then open Reports to MENRO to check its evidence, confirm the location, add remarks, and send it. The separate queues show ready reports, submissions, active MENRO review, scheduled collection, and resolution. Search and date filters stay within the assigned barangay. The server records the forwarding official's name, ID and timestamp with the audit entry and rejects duplicate or out-of-scope transitions. MENRO can select **Start MENRO review** in report management before scheduling collection. That review timestamp is stored while the report keeps its existing `For MENRO Review` value, so installed resident apps continue to recognize the status.

- Firebase Auth verifies passwords and email. New or changed passwords require 12–128 characters; existing passwords are not force-reset. Email enumeration protection is enabled.
- Server-issued claims must agree with the approved profile and barangay. Client writes cannot change roles, access status, MFA enforcement or staff scope.
- Server actions check token revocation, suspension and an eight-hour maximum staff session. The browser signs out after 15 minutes without activity and stores its session for the current browser session.
- Reactivation/approval invalidates old sessions in Auth and Firestore; a new sign-in is required. Activation stays blocked if either service fails midway; MENRO can retry.
- Report updates and their audit entries use one server transaction. Staff approvals, rejections, suspension and authenticator enrollment are audited. The latest 40 audit entries appear in User Management.
- Firestore has explicit policies for each supported collection and denies unknown collections, client audit changes, client certificate/attendance changes and private event QR tokens. Residents keep their own profile/report/registration/certificate access and signed-in access to published content.
- AI endpoints require Firebase sign-in and limit each account to 15 requests per minute. The updated Android app sends the bearer token and avoids logging tokens, prompts or image bodies.
- Staff and certificate APIs check that the expected Firebase ruleset is active. The deployment pins both features to the new policy.

## LAN and authenticator setup

Current setup is a LAN development server on port 3000. LAN HTTP does not encrypt passwords or session tokens in transit. Keep this setup on a trusted network for development. Production staff APIs require HTTPS; `TRUST_TLS_PROXY=true` is only for a configured proxy that strips untrusted incoming forwarding headers and terminates TLS.

Firebase rejected TOTP activation with `auth/operation-not-allowed`: this project needs Firebase Authentication with Identity Platform. No billing upgrade was performed. The application supports TOTP enrollment and sign-in, but MFA is not active until the owner enables Identity Platform and TOTP. The staff account page hides the unavailable enrollment section and shows the assigned role and direct links to MENRO approvals or the barangay dashboard. Existing MFA requirements are still enforced for enrolled accounts. See [Firebase's authenticator MFA setup](https://firebase.google.com/docs/auth/web/totp-mfa).

After enabling the Firebase prerequisite, use `/staff-account` to enroll from HTTPS or `http://localhost:3000` on the admin PC. Scan the displayed QR in an authenticator and verify a code. This enables server-owned MFA enforcement, invalidates old sessions, and requires a new authenticator sign-in. Removing the factor does not remove enforcement. Recovery must be handled by a trusted Firebase project owner after verifying the official's identity.

The existing verified MENRO master remains usable while Firebase MFA is unavailable. The existing unverified `Poblacion 2` semi-admin is marked `needs-review` and cannot review reports. No existing passwords were changed and no real accounts were emailed by the implementation scripts.

## Verification and deployment records (original workspace)

The website-only Git copy excludes the operational Firebase deployment and live-fixture scripts below. Keep these administrative tools, rules files and private backups in the original TrashTrack workspace. They are not part of the website build or Vercel deployment.

`npm test`, `npx tsc --noEmit`, and targeted ESLint validate the admin changes. `scripts/check-live-staff.mjs` creates isolated Firebase fixtures to verify signup restrictions, all 13 scopes, report workflow, approval and suspension. `scripts/check-live-certificates.mjs` verifies the existing certificate and attendance features. Both remove their fixtures.

`scripts/prepare-staff-security.mjs` saves the current policy, configuration and staff claims privately under `../tmp/staff-security` and compiles `../firestore.staff.rules`. `scripts/deploy-staff-security.mjs` verifies that the prepared source and baseline still match, applies the policy, updates the pins in `.env.local`, and writes a deployment record. Preparation alone never activates a policy. Do not commit the private backup or credential files. Deployment scripts are operational tools, not public routes.

Use the updated Android debug APK after this change; older versions do not attach authentication to AI calls. Existing resident Firebase sessions and personal data remain intact.
