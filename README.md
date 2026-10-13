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
