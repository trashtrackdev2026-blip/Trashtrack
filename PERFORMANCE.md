Run `npm run dev` in `admin-dashboard` for the current LAN setup. Open
`http://127.0.0.1:3000` on the PC, or the PC's current IPv4 address from other
devices on the LAN. Another app can separately occupy IPv6 port 3000 and
intercept `localhost`, so the IPv4 address identifies the TrashTrack server.

Both development and builds explicitly use Webpack. During verification on
this Windows PC, Turbopack left 1,674 orphaned PostCSS/build workers and exhausted
memory. Only orphaned workers under this project's generated `.next` directory
were stopped. Build concurrency is limited to two workers, and Next's Webpack
memory optimizations are enabled. Type checks remain enabled.
Development keeps the last ten pages compiled for ten minutes, so switching
between features does not immediately evict and rebuild earlier pages.

Dashboard pages share `src/app/(dashboard)/layout.tsx`; URLs are unchanged.
Navigation preserves the sidebar and header, shows pending feedback, and
prefetches on hover/focus. Charts have a separate bundle. GIS processing yields
between batches and cannot block the analytics KPIs while boundaries load.

Dashboard counters use Firestore aggregation queries rather than downloading
user, report, notification, and event documents just to count them. Reports
start their live subscription immediately and resolve only missing legacy
reporter names afterward. User lists render before report totals finish.
Live subscriptions show connection errors and Retry after 15 seconds.

Routine requests reuse Firebase's automatically refreshed ID token. Changes
to approved permissions and explicit account refresh still refresh claims.
The server continues checking revocation, staff approval, barangay scope,
session age, required MFA, and the production HTTPS requirement. Account
verification requests project MFA setup information only for the security page.
Certificate/event APIs reuse one verified account within each request.

Inter and Outfit are served from local WOFF2 assets with their licenses;
development/builds no longer fetch fonts from Google.

Verification: `npm test`, `npx tsc --noEmit`, `npm run build`, and
`node scripts/check-performance.mjs`. The latter measures anonymous first and
repeat page HTTP responses and writes `../tmp/admin-performance.json`; it does
not measure end-to-end signed-in Firebase latency. The live security and
certificate checks use isolated fixtures and default to IPv4. Use
`ADMIN_BASE_URL` to target a different port/address when required.

The performance and live-fixture scripts described above stay in the original
workspace and are excluded from the website-only Git copy. The copied project
retains its unit tests and deployment/bundle validation scripts.

Final verification: 33 unit tests, TypeScript, the Webpack production build,
and modified-code lint passed (existing lint warnings remain). Seven live
staff/security groups and fourteen live certificate checks passed; all their
temporary records were removed. Anonymous repeat page responses measured
58–163 ms, averaging 95 ms. First uncached visits still compile in development.
Public signup was checked at phone width with no horizontal overflow. Creating
an additional privileged browser fixture was rejected by automatic approval,
so a signed-in interactive browser check remains unverified.

`npm run build` produces an optimized production build. Production staff APIs
still require HTTPS; keep using the LAN development setup until HTTPS is
configured. Do not disable security checks to speed up loading.
