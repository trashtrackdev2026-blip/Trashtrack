# TrashTrack Admin

Next.js dashboard for MENRO and approved barangay staff. Firebase handles authentication/data, Cloudinary hosts uploaded media, and the server provides AI, phone notifications, attendance QR codes and certificates.

Requires Node.js 24.x.

```sh
npm ci --include=dev
```

Copy `.env.example` to `.env.local` and fill in the existing Firebase/Cloudinary configuration and server secrets. A Firebase Admin service-account file can be used locally through `GOOGLE_APPLICATION_CREDENTIALS`. Keep real environment/credential files private.

```sh
npm run dev
```

Development listens on port 3000 for localhost/LAN use. The `/seed` sample-data tool is available only in development.

```sh
npm run check:deployment
npm test
npm run build
npm run check:bundle
```

See [VERCEL-LAUNCH.md](./VERCEL-LAUNCH.md) for the prepared Vercel configuration, environment import, Firebase domain setup, Android backend change, and launch checks. `npm run prepare:vercel` creates a private import file; it does not publish the dashboard or change Firebase permissions.

Existing workflows and security details are documented in [ADMIN-SECURITY.md](./ADMIN-SECURITY.md) and [PERFORMANCE.md](./PERFORMANCE.md).

Publishing a collection schedule or event now saves its barangay announcement in the same server transaction and queues a phone notification for that barangay. MENRO can also target all barangays. Retrying the same publication ID reuses the saved post and notification. The Notifications page shows the actual audience, phone delivery state and retry action.

The resident scanner accepts clean identifiable disposal items and distinguishes an unclear image from a person or animal. Model confidence values expressed as probabilities are normalized to percentages. The Android app includes event archives, working participation/certificate filters and a full-schedule barangay selector; install its updated APK to use those screens.
