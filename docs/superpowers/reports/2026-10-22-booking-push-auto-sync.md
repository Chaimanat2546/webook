# Push device automatic synchronization

## Problem and change

The installed Staging iPhone PWA displayed Push enabled while a server-accepted
delivery to its previous binding did not appear on the phone. A manual off/on
cycle produced another binding, after which display and standalone launch were
confirmed. The old UI trusted browser subscription presence and a local actor
marker without verifying that the server retained the current device binding.

The root guard now idempotently registers the current browser subscription on
authenticated app load, focus, foreground resume, reconnect and worker activation.
Previously opted-in devices with granted permission can restore a missing browser
subscription without requesting permission again. Device settings require server
acknowledgment before showing enabled; configuration retry actually reloads it.
Other devices remain subscribed, and explicit opt-out/account isolation is retained.

Shared Web Locks serialize mutation across app contexts where supported, with an
in-context fallback. Actual mutation completion controls lock release, independently
of UI deadlines. Opt-out immediately begins destructive local unsubscribe and queues
server cleanup; late subscribe/register results are compensated after revocation.
Logout has a bounded wait. A revocation revision prevents an earlier explicit
enable from restoring consent after another context opts out. Closing settings by
itself does not revoke consent. A failed browser retirement remains unconfirmed.

The Server Action validates expected actor against the verified current session
before privileged writes and avoids rewriting an unchanged binding cookie.
No schema change or dependency was required. This is unrelated to house workspace
pages; the existing notification settings and Button are reused.

## Verification

- Regression failures were observed for missing server binding, renewed endpoint,
  false enabled status, actor mismatch, redundant cookie mutation, missing config
  retry, failed disable rerender, premature lock release and late explicit enable.
- 43 focused tests passed after the fixes, including stalled mutation/logout,
  missing browser subscription, foreground/reconnect retry and cross-context lock.
- Independent targeted review: all reported findings addressed, no remaining
  findings; reviewer independently reran 27 focused tests successfully.
- Full local `npm run verify`: typecheck and ESLint passed; 1,249 tests passed,
  zero failed, four optional integration skips. Staging CI runs those integrations
  against disposable services with no skips. `npm run build` passed.

## Staging acceptance plan

Only Staging is authorized. Retain a private backup of the verified installed PWA
binding, remove only that server row, then open/update the installed PWA without
toggling Push. Confirm the same browser endpoint and keys re-register automatically,
then create a marked QA booking, inspect scheduled delivery and confirm actual
iPhone display/standalone launch. Remove only QA booking fixtures afterward.
Provider acceptance alone is not physical display evidence.

## Deployment evidence

- Commit: `28e5eb9c1e56906624e67d6dfb27684d6ff567eb`.
- Staging CI/CD: https://github.com/Chaimanat2546/webook/actions/runs/39780031426
- CI completed successfully: **1,325 tests passed; zero failed or skipped**.
- Worker version: `819023ed-f114-4b1d-abfa-ba6b6d62ee08`.
- Both compiled-bundle guards passed: Staging project present, Production absent.
  Temporary runtime secret-file cleanup passed.
- Live health: login 200, protected dashboard 307 to login, unauthenticated inbox
  401 with private/no-store JSON, service worker 200 matching the committed bytes.
- Live service-worker SHA-256:
  `eb9ef826b3a086dd550ec25f0c7410b036506da5b075fb5fbaa98d04a877225a`.
- Only staging was pushed. Main remained
  `d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1`.

The verified PWA binding was backed up privately and only that server row was
removed for the recovery test. Browser consent and the other device were retained.
Physical-device recovery and display confirmation are pending the installed-PWA
update; no off/on cycle is requested.

The phone update was not yet confirmed during the active turn. To avoid leaving
the test device without its server binding while waiting, its backed-up endpoint
and keys were restored through the Staging subscription RPC. This restoration is
test-fixture recovery, **not evidence of automatic repair**. No booking/house or
customer fixture was created in this attempt. Both device bindings are retained.
Physical acceptance must still confirm synchronization without toggling Push.

## Installed-PWA update follow-up

The user confirmed updating from the installed Staging PWA and seeing enabled
**without disabling or enabling Push**. A fresh Staging inventory found one new
binding for the same account at **20:06:27 ICT**, with a different endpoint from
the previously backed-up PWA. The other known device was unchanged. The previous
PWA endpoint was absent; its cause of retirement is not established by this check.
The new endpoint registration, together with the user's no-toggle confirmation,
verifies automatic registration after this update. This is not claimed as the
planned same-endpoint missing-row recovery test because the backup had already
been restored while waiting for the user.

A new confirmed QA booking **684**, inactive house **DV 99882204**, created one
admin inbox notification and two device delivery jobs. The scheduled Staging
dispatcher marked both sent on attempt one, including the new PWA binding at
**20:08:36 ICT**. No provider error was recorded. Physical display and standalone
launch confirmation were requested separately from successful provider submission.
The marked QA booking/house/customer were retained until that confirmation.

The deployed commit and CI success were rechecked. Main remains at the SHA above.
This follow-up changes only verification documentation; no application behavior
changed, so another build/test run or deployment is unnecessary.

## Physical acceptance and cleanup completed

The user then confirmed **received Push and opened the PWA without a Safari URL
bar**, following the earlier explicit confirmation that Push was not toggled.
This completes the observed update → automatic registration → new booking →
mobile display → standalone detail launch scenario on Staging.

After the notification click, the same new PWA binding was still present and had
synchronized again at **20:19:11 ICT**. It was not replaced for this return to the
app. This confirms the exercised foreground sync retained the working device.
It does not imply that arbitrary future browser/OS revocations can be ignored.

Booking 684, its one notification and two delivery rows, the marked inactive
house and synthetic customer were removed. A fresh SQL check confirmed **zero**
remaining QA bookings, houses, customers, notifications or deliveries. The current
PWA binding and the one other device binding were preserved. No Production
deployment or mutation was performed. Documentation-only finalization requires
no new application build, test run or deployment.
