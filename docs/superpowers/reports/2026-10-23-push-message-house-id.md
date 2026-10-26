# Push title and house DV — Staging

## Requested behavior

Push notifications use the title **WeBooks** and one of these bodies, with the
captured house ID (DV):

- `มี booking ใหม่ • DV 12345`
- `ชำระเงิน booking สำเร็จ • DV 12345`
- `ยกเลิก booking • DV 12345`
- `booking หมดเวลาชำระเงิน • DV 12345`

This is a bounded extension of the existing Push flow. The existing inbox UI,
all-admin/matching-owner recipient scope and PWA detail launch are unchanged.
No new dependency or component is needed. Existing installed PWAs need one
normal update to activate the new display, without toggling Push off/on.

## Implementation and review

The new `20261023090000_booking_push_house_id.sql` migration replaces only the
service-role claim RPC, adding captured `property_id::text` to its JSON payload.
Existing scope checks, locks, leases and grants remain in force. The repository
and encrypted sender preserve the DV as decimal text; shared validation rejects
invalid/non-positive/out-of-bigint-range IDs without losing JavaScript precision.
The worker displays fixed labels and the validated DV, ignoring arbitrary supplied
title/body text. Missing DV in older payloads shows the event without a suffix.
There is no historical event backfill or device-registration change.

Independent read-only review found no functional/security blocker and ran all
15 focused tests successfully. Its artifact-fingerprint note was addressed by
regenerating `public/sw.js` after the final source edit.

## Verification

- RED observed for old worker title/body, missing DV in the repository/encrypted
  payload, malformed-DV handling and missing claimed-DV SQL contract.
- GREEN: all 15 focused worker/encryption/repository tests passed.
- Real disposable localhost PostgreSQL: **18 tests passed**, no failures/skips,
  including claimed house DV, recipient scope, permission revocation and leases.
- An initial concurrent typecheck/build attempt raced on generated `.next` types;
  final build and verification were rerun sequentially.
- Final `npm run build` passed. Final `npm run verify` passed typecheck, ESLint
  and **1,257 tests**, with zero failures and four optional integration skips.
  The separate real notification SQL suite above ran without skips; CI enables
  every integration suite and rejects any skipped tests.

Staging deployment and final live verification evidence is recorded below when
the CI/CD rollout completes. Production is excluded throughout this change.

## Deployment security gate

The first CI run, [39826327182](https://github.com/Chaimanat2546/webook/actions/runs/39826327182),
stopped at `npm run audit:security` before migration/deployment. Local audit
reproduced the failure against existing Next.js 16.3.8. The dependency database
now flags [image optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
and [App Router Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r)
advisories affecting that version, fixed in Next.js 16.4.1 and later. The existing
sharp override already addresses the documented image-library workaround, but
the Server Actions advisory requires a Next.js upgrade.

Update existing `next` and `eslint-config-next` together to pinned 16.4.2; no new
direct dependency or security-gate bypass is introduced. The installed OpenNext
1.20.2 peer range accepts this version. Re-run audit, build, typecheck, ESLint,
the full test suite and CI's native OpenNext/Workers build before deployment.

After the upgrade, `npm run audit:security` reports zero vulnerabilities in its
production-dependency scope and `npm run build` passes on Next.js 16.4.2.
Independent dependency review found no unexpected package/workflow changes or
compatibility blocker; changes are limited to Next.js and its matching ESLint,
environment and platform compiler packages. Post-upgrade `npm run verify` passed
typecheck, ESLint and 1,257 tests (zero failed, four optional integration skips).
The replacement CI run is tracked with final rollout evidence below.

## Worker runtime compatibility correction

CI [39827469678](https://github.com/Chaimanat2546/webook/actions/runs/39827469678)
passed all 1,338 tests and deployed commit `61bbac9b199565379b91d82036e7f3a937c27aae`.
The post-deploy probe caught a dynamic-route initialization failure despite the
successful build/dry run: `Unexpected loadManifest(/.next/server/preview-props.json) call!`.
The Push asset, migration, RPC permission checks and four real encrypted protocol
deliveries passed, but this revision was not accepted as ready because login and
other dynamic routes returned 500.

Runtime tail isolated the old OpenNext 1.20.2 adapter's missing Next.js 16.4
preview manifest. The official [1.20.12 release](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs%2Fcloudflare%401.20.12)
adds Next.js 16.4 support and [PR 1356](https://github.com/opennextjs/opennextjs-cloudflare/pull/1356)
fixes that exact manifest omission. Update the existing adapter to pinned 1.20.13
(also containing webpack named-chunk fixes) and its required Wrangler to 4.148.0.
Their added minifier transitively selected vulnerable glob 10.3.3; a narrowly
scoped `@node-minify/core` override selects glob 10.5.0, retaining its compatible
major version and passing the unchanged production audit gate.

The regression test executes the real adapter transformation against Next.js's
actual `load-manifest.external.js` and isolated fixture preview props. Removing
only the upstream preview-props entry reproduced `Unexpected loadManifest`;
restoring the released adapter passed and unknown manifest paths still fail.
Dynamic HTTP health is a required final acceptance check below.

The updated Miniflare schema rejects the old iCal test fixture's `config.type`;
remove that obsolete fixture field. Both enabled iCal runtime cases and the new
manifest regression pass (three tests, zero skips). Independent review found no
adapter, override or regression-test blocker.

CI validation now starts the compiled Worker locally with the Staging config and
requires login 200, dashboard 307 and notification API 401 before the deployment
job can begin. It uses the validation job's placeholder public environment and
local bindings, with no deployed database or remote Worker mutation. This checks
server initialization rather than relying on build/dry-run success alone.

Final local checks with the corrected adapter: production audit zero
vulnerabilities; build, typecheck and ESLint passed; 1,258 default tests passed
with four optional integration skips. Separate enabled runtime tests passed as
above. Independent review also approved the CI smoke gate and fixture update.
