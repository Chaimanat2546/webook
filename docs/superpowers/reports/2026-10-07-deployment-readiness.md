# Deployment readiness — 7 October 2026

## Remote synchronization — 8 October 2026
- Refreshed origin. `origin/main` and local HEAD both pointed at `0bace64`, but `origin/feature/dashboard` contained three missing commits ending at `2192019` (dashboard cleanup and quotation theme/PDF updates).
- Integrated that remote feature branch with `--no-commit`; retained all local analytics work via backup stash `4b10ebbcd705d33ddba54a17fa15524eeac659fa`.
- Resolved global palette conflict in favor of the newer remote palette and regenerated the service worker. Merge is intentionally uncommitted pending user authorization.
- Earlier Staging/PDF verification describes the prior code. The integrated revision needs a fresh Staging rollout and PDF verification before Production readiness can be claimed.

## Recheck — 8 October 2026
- Latest mobile-summary Staging release: `0f340c62-336a-4a43-8ae1-765fe0ad188f`; Next/OpenNext build and deployment passed. Mobile disclosure and no-horizontal-overflow verified after release.
- Fresh full suite: 896 passed, zero failed, one skipped (897 total). Fresh lint: zero errors, 11 warnings.
- Production target configuration matches `webook-admin`, account `7c1d945e149fc6fad2124176124d8f33`; `.env.production` points to the approved Production Supabase project.
- RESOLVED: after the user explicitly requested configuration, all five `ANALYTICS_REPORT_TOKEN_*` secrets were uploaded to Production Worker `webook-admin` and independently confirmed present by remote secret inventory. Values were never printed. This updates Worker configuration; the new application code has not been deployed to Production.
- Production read-only house lookup returned HTTP 200; sample IDs 9 and 2661 both have titles. This supports a Staging catalog mismatch for those sample rows, not a guarantee for every source ID.
- PDF follow-up passed on Staging: created a clearly labelled DEMO seller profile, customer, one catalog fixture and quotation `QO-202610080001` (`955fbfff-1efe-427d-9d18-3f1085c61ccb`). Saved through the application and downloaded through Export > PDF. File: `C:/Users/chaym/Downloads/QO-202610080001.pdf`, 30,975 bytes, one page. PDF text confirms document number and 3,000.00 total (2 nights x 1,500.00); rendered page visually confirms readable Thai, layout and totals without overlap. Evidence: `.superpowers/website-analytics/staging-pdf-page-1.png`. Fixtures remain labelled DEMO on Staging only. This covers saved-document download, not physical printing, every template or multi-page output.
- No new Webook schema migration is required by the analytics change. Changes remain uncommitted. Production deployment is not authorized by this readiness request and was not performed.

Scope: Webook analytics API/dashboard, compact mobile statistics, website summary navigation, shared blue/green theme. Branch: feature/dashboard. Changes remain uncommitted.

## Verified
- Production Next.js build and TypeScript passed.
- ESLint: zero errors, 11 existing warnings.
- Full suite: 896 passed, 0 failed, 1 skipped (897 total).
- Regenerated public/sw.js to resolve stale release fingerprint; full suite rerun passed.
- Independent final review: no actionable P1/P2 findings.
- Recent browser checks cover desktop/mobile Dashboard and house list theme, two analytics websites and compact disclosures.
- Staging target guard passed. Local staging/production Supabase references match their documented environments; no secret values recorded.

## Staging release
- User approved Staging. Deployed using `npm.cmd run deploy:cf:staging`.
- URL: https://webook-staging.chaymanus2003.workers.dev
- Worker version: `9bb4d5cb-5099-4411-a282-69b912e52cbb`.
- Provisioned and confirmed all five ANALYTICS_REPORT_TOKEN_* server-only secrets on Staging; values were not logged.
- Fixed Cloudflare fetch compatibility: use `redirect: "manual"` and reject non-OK responses, including redirects, without forwarding tokens. Focused client tests: 4 passed. Independent review of client/staging fixes found no P1/P2 issues.
- Staging deploy now pins its account and populates OpenNext remote cache before deployment, preventing stale manifest/theme responses.
- Final bundle contains the Staging Supabase reference in 14 files and the Production reference in zero files. `.env.production` restored after build.
- Authenticated browser checks (October 2026): NASA 203 page views / 0 contacts / 8 gallery opens; Pukmood 735 / 3 / 375. Counts are a point-in-time snapshot, not unique people.
- Pukmood full-list navigation retains the selected website/month and displays search, sorting and pagination (227 houses).
- Observed limitation: tested house rows display the missing-registry-name fallback; IDs and statistics load. House-name matching must be checked against the intended environment's registry before Production.
- Unauthenticated analytics API returns 401; Dashboard redirects to `/login`; manifest returns 200 with theme `#2563eb`.
- Final deploy build passed; final lint has zero errors and 11 existing warnings.
- Production was not deployed. Changes remain uncommitted.

## Production requirements
- No new Webook database migration is required for these changes; source analytics report endpoints must already be deployed.
- Staging: use npm run deploy:cf:staging. Its script rebuilds with the staging environment; do not deploy the generic local build as staging.
- Production requires exact-target confirmation under AGENTS.md.
- Verify admin-only access, selected-site navigation and counts after release. Do not count unavailable source data as zero.

Logs are retained locally under .superpowers/website-analytics/predeploy-*.log.

Cloudflare OpenNext full worker build passed. The initial skipNextBuild attempt was invalid against a normal Next build (missing standalone manifest); the complete adapter build produced the worker successfully.

Wrangler dry-run passed before the authorized Staging release. OpenNext emits a non-blocking color-string package-copy diagnostic because its export transformer assumes an object rather than the package's string export. Worker bundling and deployment succeed. A local React PDF/color smoke check produced a valid 1,682-byte PDF; this does not replace an interactive quotation PDF check on Staging.

Staging evidence and logs are retained locally under `.superpowers/website-analytics/`, including `staging-verified.png`, `staging-deploy-final.log`, and `staging-redirect-tests.log`.
