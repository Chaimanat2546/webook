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

## Accepted Staging rollout

- Application commit: `62b6559e9a3cb9e6bb60a916512f3572b65d1292`.
- CI/CD: [39829961652](https://github.com/Chaimanat2546/webook/actions/runs/39829961652)
  succeeded with **1,339 tests passed**, zero failures, cancellations or skips.
  Compiled-Worker local HTTP smoke, Staging-present/Production-absent bundle
  guards and temporary runtime-secret cleanup all passed.
- Worker version: `322a70c0-2bf6-4ffe-a828-2737faf228b4`.
- Post-deploy HTTP probes passed: login 200, dashboard 307 to login,
  private/no-store notification API 401 and `/sw.js` 200.
- Deployed PWA artifact matched committed source, SHA-256
  `107bafb815a56ef6706d9716d3ae3168dd428795a376c67416a670ed64ec43db`.
- Read-only Staging SQL confirmed migration applied, captured DV in claim JSON,
  service-role claim access and browser-role denial. Both original subscriptions
  remain; earlier QA fixture cleanup was reverified with all fixture counts zero.
- An ephemeral real Mozilla Push channel received and independently decrypted
  four messages. Each contained exactly UUID, event type and `propertyId`.
  Running those received payloads through the deployed service-worker artifact
  produced **WeBooks** plus the exact four requested event/DV bodies, using
  synthetic DV 99882215. The provider channel was unregistered afterward.
- This protocol smoke created no database fixture and sent nothing to
  existing phone subscriptions. It proves provider delivery and deployed handler
  formatting; physical iPhone acceptance was performed separately below.
- Remote `main` remains `d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1`; only
  `staging` was advanced. No Production deployment or database operation occurred.

Existing installed PWAs need their normal one-time update to show this format;
Push does not need an off/on cycle.

## Physical iPhone acceptance and scope closure

On 23 October 2026, after updating the installed Staging PWA, the user requested
all four Push formats on their phone. Four format-only messages were sent solely
to the previously verified Apple PWA registration, with distinct notification
UUIDs and synthetic DV 99882215. Apple accepted every send with HTTP 201 between
01:30:58 and 01:31:02 Asia/Bangkok. No database fixture or real booking was
created, and the other device was not sent these test messages.

The user explicitly confirmed: **ได้รับครบ 4 และข้อความกับ DV ถูกต้อง**.
This confirms physical receipt and the requested WeBooks title/event/DV display
for all four formats. The format-only messages do not exercise booking-detail
navigation; prior real-booking PWA click acceptance remains separate evidence.

The requested Staging work is complete. Merging into main or deploying to
Production is outside this request and is not an outstanding Staging task.
This documentation-only closure changes no runtime behavior; build/test reruns
and another deployment are unnecessary. The report is retained in the feature
branch repository without advancing main or redeploying Staging.
