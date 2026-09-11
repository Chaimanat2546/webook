# Dependency security remediation — 11 September 2026

Scope: fix the dependency findings reported during PWA work before release.
This change does not deploy or publish the application. Push Notification and
Store distribution remain deferred.

## Changes

- Next.js and eslint-config-next: 16.2.9 → 16.3.4, pinned together.
- Wrangler: 4.105.0 → 4.131.0. The Windows deployment script now invokes the
  installed, lockfile-controlled CLI instead of downloading an older pinned CLI.
- Patched compatible transitive dependencies with `npm audit fix` (without
  `--force` or custom overrides): sharp, PostCSS, Tailwind's PostCSS integration,
  Undici, Hono, its Node adapter, brace-expansion, fast-uri, ip-address, js-yaml,
  nanoid and qs. Wrangler supplies its own updated Miniflare/workerd versions.
- Updated version-specific install-script permissions for sharp and workerd.
- Added `npm run audit:security` to PR validation, main validation and the
  production deployment job after `npm ci`. The command fails for moderate,
  high or critical advisories, and registry errors also stop the job. Existing
  production environment approval and validation dependencies remain intact.

Next.js documents the security fixes in its
[August 2026 security release](https://nextjs.org/blog/august-2026-security-release).
Version 16.3.4 is newer than the fixed 16.3.3 release. This upgrades the affected
dependency rather than assuming that individual exploit prerequisites cannot occur.

## Evidence

- Before: 15 npm audit findings (4 moderate, 10 high, 1 critical).
- After: `npm run audit:security` reports **0 vulnerabilities** for the full
  dependency tree, including development dependencies.
- `npm run verify`: typecheck, ESLint and all **620 tests** pass.
- `npm run build`: passes on Next.js 16.3.4.
- Full `opennextjs-cloudflare build`: completes with exit 0 and emits the Worker.
  The first attempt to reuse the ordinary Next build with `--skipNextBuild`
  lacked standalone output; the full OpenNext command generates that output.
- Wrangler 4.131.0 `deploy --dry-run`: exit 0; gzip bundle 2550.41 KiB.
  This only bundles locally; nothing was uploaded or deployed.
- Independent dependency/CI review: no actionable findings.

OpenNext 1.20.1 logs `Failed to copy ... color-string` while inspecting package
export conditions: its helper applies the `in` operator to that package's string
`exports` value. The package is present in the generated server dependencies and
esbuild inputs, and Wrangler bundling succeeds. The same helper exists in 1.20.6,
so the adapter was not upgraded speculatively. This adapter diagnostic remains
documented; these checks do not replace authenticated PDF/runtime acceptance.

The audit result is a dated check against the npm advisory database, not a
guarantee that no undiscovered vulnerabilities exist. Physical-device PWA,
authenticated flow and Staging acceptance work remain tracked separately in
[the PWA checklist](pwa-checklist.md).
