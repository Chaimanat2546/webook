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
