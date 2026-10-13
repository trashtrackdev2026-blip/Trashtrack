# Vercel launch for TrashTrack Admin

Prepared on 13 October 2026. This folder is a Next.js project with server functions; use the Next.js framework preset. The cloud deployment uses the existing Firebase project, staff approvals, reports, events and attendance data.

## Prepared files

- `vercel.json`: Next.js preset, reproducible `npm ci --include=dev`, and `npm run build:vercel`.
- `package.json`: Node.js 24.x, patched Next.js/ESLint versions and launch checks. Keep `package-lock.json` with the source.
- `next.config.ts`: bundles the certificate template/font/license in both certificate functions, excludes private files from server traces, adds response protection headers and disables caching for authenticated APIs.
- `.env.example`: all supported deployment variables without values.
- `.gitignore` / `.vercelignore`: exclude local environment files, private exports, service-account JSONs and local build outputs.
- AI routes explicitly use the Node.js runtime with a 90-second maximum; the provider request itself has a 55-second timeout. Certificate routes allow 60 seconds. Enable Vercel Fluid Compute for the configured function durations.
- `/seed` returns 404 in production so the development sample-data button cannot be used on the launched dashboard.

Node.js 24.x is supported by Vercel. Next.js `outputFileTracingIncludes` supplies local runtime assets; a static export would remove required APIs. See [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [function limits](https://vercel.com/docs/functions/limitations), and [Next.js output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Environment variables

This Git copy contains no real environment or credential files. The prepared private import file remains on the original PC at `D:/Trashtrack/admin-dashboard/deployment-private/vercel-production.env` for Vercel's **Import .env** option. Keep it local; do not commit, email, attach or upload it as site source. To regenerate one from an appropriately configured local `.env.local`, use:

```sh
npm run prepare:vercel
```

In Vercel, open the project's **Settings → Environment Variables** and import that file for **Production**. Treat the two server secrets below as sensitive/secret variables. If the import interface does not preserve those flags, set them individually with the same names. Do not paste values into source code or chat. Preview deployments should use a separate Firebase test project and credential when available; giving previews production variables gives their approved users access to production data.

| Variables | Source / purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Existing Firebase **Web app** configuration; bundled into the browser at build time. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Existing Cloudinary cloud name and unsigned upload preset. Keep the preset's upload constraints in Cloudinary. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Server secret**: complete Firebase Admin service-account JSON as one value. The export converts the existing local credential file to this variable. |
| `GEMINI_API_KEY` | **Server secret**: existing Gemini key used only by authenticated AI APIs. |
| `STAFF_SECURITY_RULESET`, `CERTIFICATE_SECURITY_RULESET` | Existing validated active Firestore ruleset UUID. Both must match the same active policy; the read-only check verifies this without changing rules. |
| `TRUST_TLS_PROXY` | `true` for Vercel's managed HTTPS proxy. |

Do not set `GOOGLE_APPLICATION_CREDENTIALS` on Vercel: a Windows file path exists only on the PC. Do not add a `NEXT_PUBLIC_` prefix to server secrets. Environment changes require a new deployment, particularly public Firebase/Cloudinary variables embedded during the build. [Vercel environment variables](https://vercel.com/docs/environment-variables), [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

## Create the Vercel project

This folder is a website-only Git repository on branch `main`. Its `package.json` and `vercel.json` are at the repository root. Creating or pushing this repository does not publish a live Vercel URL.

Import the pushed repository at [Vercel New Project](https://vercel.com/new). For this website-only copy, use **Root Directory: repository root (`.`)**. The Android app and operational Firebase deployment/fixture scripts are excluded. Existing Firestore rules stay managed separately in the original TrashTrack workspace.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Node.js | 24.x |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build:vercel` |
| Output directory | Next.js default; no static `out` override |
| Fluid Compute | Enabled |

Add production variables before the first production build. Preview builds also need required variables for their selected environment. Preflight intentionally fails with missing/invalid configuration instead of publishing a broken sign-in page. Vercel CLI can also deploy this folder after signing into and linking the intended project; run CLI commands from `admin-dashboard` so `.vercelignore` applies. [Vercel CLI deployment](https://vercel.com/docs/projects/deploy-from-cli), [ignored files](https://vercel.com/docs/deployments/vercel-ignore).

## Firebase domain and Android setup

1. After Vercel assigns a stable production URL, add its hostname (without `https://` or a path) under **Firebase Console → Authentication → Settings → Authorized domains**. Add a custom hostname too if used. Keep the existing Firebase auth domain; do not replace it with a Vercel URL merely because hosting moved.
2. Use the HTTPS URL for MENRO and semi-admin sign-in. Existing approvals and barangay scopes remain enforced; deploying does not change passwords or roles. Hosting does not enable Firebase Identity Platform or TOTP.
3. Set Android `resident-app/local.properties` **`BACKEND_BASE_URL=https://your-stable-production-hostname`**, then rebuild/install the APK. The final hostname is needed before this change can be made. This moves AI, attendance APIs and certificate requests from the PC/LAN to Vercel; Firebase data/media keep their existing hosts.
4. Phone-facing production APIs must reach the app's Firebase authentication layer. A Vercel login/protection page in front of production prevents Android API calls. Keep preview protection separate; do not put a Vercel bypass secret in the phone app.

## Verification and rollout

```sh
npm run check:deployment -- --verify-services
npm test
npm run build
npm run check:bundle
```

The Firebase check reads Auth configuration, one Firestore record and the active ruleset. It prints no user records/credentials and performs no writes. The bundle check requires the template, script font and license in both certificate traces and rejects private configuration in server traces.

On the assigned HTTPS URL, verify using existing approved/test accounts:

- MENRO sign-in/staff access and semi-admin access limited to the assigned barangay.
- Community Reports/Reports to MENRO, maps, schedules, resources and existing events.
- Certificate preview, an eligible participant's certificate download, and attendance QR download/printing.
- A phone notification and an authenticated AI request after installing the APK with the new URL. These contact production services; use deliberate test content and recipients.
- `/seed` returns 404; protected APIs without a Firebase bearer token return 401.

AI endpoints cap base64 input at 4,000,000 characters, below Vercel's 4.5 MB function request limit. Media uploads go directly to Cloudinary. Keep documents/videos hosted on Cloudinary/Firebase; local server files are not persistent upload storage.

Delete the private import folder after setting Vercel variables. Roll back by restoring a known-good Vercel deployment; data/accounts remain in Firebase. Do not run Firebase security deployment or fixture scripts during a Vercel build.

## Verified preparation

The exact `build:vercel` command passed using the exported cloud configuration with the local credential path disabled. All 54 regression tests passed, targeted ESLint passed, and the production dependency audit reports zero advisories. The full dependency audit still flags nine advisories in development tooling under the shadcn CLI; that CLI supplies build-time CSS and is not imported into server functions. Compatible runtime fixes include Next.js 16.4.0, gRPC 1.14.6 and UUID 11.1.1 for gaxios 6.

The read-only Firebase check passed against the existing project and policy. Certificate function traces include the template, font and font license and exclude private configuration. A temporary production startup check verified four public pages/assets, `/seed` returning 404, response protection headers, and all 11 protected APIs returning 401 without a token. No production account/record was changed, no notification was sent, and no new Vercel deployment was created.

The website-only copy is at `D:/Trashtrack/trashtrack-web`. Its source/config/assets are ready for Git push. The private environment file stays in the original dashboard folder and must be imported separately as Vercel project variables. `npm run package:vercel` optionally packages this copy into a source ZIP; a ZIP is not a built static website.
