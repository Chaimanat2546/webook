# Booking notifications: live Staging acceptance — 2026-10-22

## Scope and fixtures

Target: `https://webook-staging.chaymanus2003.workers.dev`, Supabase project
`sxvkhzhqtrpxgzumsswl`, Cloudflare account `0df55f166fa309dcc904e992c43f86db`.
No Production deployments, schema changes, configuration changes or data mutations
were authorized or performed.

The initial Staging inventory contained one linked admin, no linked owners and no
Push subscriptions. Four synthetic accounts were added: two admins and owners for
DV `99882201` and `99882202`. Two inactive, clearly marked QA houses were created.
Existing users and houses were not modified. The user subsequently enabled an
Apple Push subscription on the existing admin account.

Test fixture marker: `QA-NOTIFY-bd296bff`; private credentials and subscription
keys remain outside version control in the ignored task directory.

## Defect found and fixed

The first live bookings correctly created eight inbox items: three admins and the
matching owner for each of the two houses. Authenticated HTTP inbox checks showed
the expected bookings. Mobile browser inspection showed each owner only their
own DV; following an admin's notification link as an owner rendered the denied /
not-found screen without the other house's data. The owner's own notification
opened normally and changed to the read state.

Push deliveries instead became `retry` with the safe error code `push_network`.
A local native Workers reproduction isolated the error: Workers rejects
`redirect: "error"` before making the request. This behavior is also documented
in [Cloudflare's Request API](https://developers.cloudflare.com/workers/runtime-apis/request/).

The transport now uses `redirect: "manual"`. Existing outcome classification
rejects every 3xx response and never follows its Location, preserving the endpoint
allowlist and preventing forwarding of VAPID headers or payloads.

- Fix commit: `6a98c17ac30836bffa1ab9933286b1a4819cca78`.
- Native Workers regression failed before the change with `retry/push_network`.
- The same regression passed afterward, checking successful HTTP 201 and rejected
  HTTP 302 with no request to the redirect destination.
- Targeted transport/runtime/PWA checks: 7 passed.
- Local typecheck/lint/test verification: 1,220 passed; 0 failed; four optional
  integration tests skipped. Lint had existing warnings and no errors.
- Independent review found no actionable issues.

The first full local verification detected the expected stale generated PWA
revision after the source change. Regenerating through `npm run build:pwa` and
rerunning verification resolved it. The two bookings from the failed live attempt
and their notification/delivery rows were removed before the final acceptance
round; only synthetic test rows were removed.

## Final live verification

The fix was deployed successfully through
[Staging CI/CD run 39770413951](https://github.com/Chaimanat2546/webook/actions/runs/39770413951).
Both jobs succeeded, including audit, typecheck, lint, build, OpenNext build,
Wrangler dry-run, migration check, deployment, bundle target checks and runtime
secrets-file cleanup. CI ran **1,296 tests: all passed, none skipped**.

- Worker version: `95305cc9-bbbf-4030-82ef-1756c16ba205`.
- The Staging Supabase reference was present in the bundle; the Production
  reference was absent.
- Live unauthenticated login returned 200, Dashboard redirected to login, and
  notification API returned 401 with private/no-store caching.
- Live Service Worker bytes matched the committed artifact, SHA-256
  `db10c4e0666931469bac5786cffaa0f1f97a2dc5ee1e5d7db624c65eb8542b42`.

After deployment, two new bookings were created through the existing
`admin_create_house_booking` RPC, using a synthetic customer and future dates:

| Case | In-web recipients | Actual Push result |
| --- | --- | --- |
| House A, DV 99882201, waiting, booking 646 | All three admins + owner A; owner B excluded | Four successful sends; owner A received, owner B had no delivery |
| House B, DV 99882202, confirmed, booking 647 | All three admins + owner B; owner A excluded | Four successful sends; owner B received, owner A had no delivery |

All eight database recipients matched the expected set exactly. Authenticated
HTTP checks for the four synthetic accounts returned precisely their permitted
bookings, with authorized detail content. Both owner accounts received a
not-found result without the other house's title when opening another recipient's
notification URL. With streamed Next.js HTML, these not-found responses carried
HTTP 200 and `NEXT_HTTP_ERROR_FALLBACK;404`; the response status alone was not used
as evidence of access. Browser inspection independently showed the denied page.
One synthetic admin had all tool permissions disabled, including booking, and
still received both notifications as required by the role-1 rule.

For Push, four independent protocol test subscriptions were registered with the
real Mozilla public Push service, using distinct ECDH/auth keys per account and
the deployed Staging VAPID public key. The deployed scheduled Worker claimed and
sent the jobs naturally; no local dispatcher or mocked provider was used in this
live round. The receiver obtained and independently decrypted all six expected
messages: two per test admin and one per matching owner, with no message for the
wrong owner. Decrypted payloads contained only their notification UUID.
The [Mozilla protocol documentation](https://mozilla-push-service.readthedocs.io/en/latest/design/)
describes the registration, delivery and acknowledgment transport used here.

The existing admin's real Apple subscription received two additional successful
provider submissions. All eight deliveries reached `sent` on attempt 1 with no
error, around **18:37:36 ICT**. The user then confirmed **the mobile notifications
appeared and tapping one opened the details**. Physical-device display/click was
verified for this admin's Apple device; the synthetic accounts' Push evidence is
real provider delivery/decryption, rather than separate physical phones.

The user subsequently clarified that the detail opened in Safari with a URL bar,
while launching the Staging Home Screen icon correctly opens standalone. Thus the
above result confirms delivery and authorized detail access, **not standalone PWA
launch**. Follow-up verification is required for the notification click handler.

Updating a test booking did not create duplicate notifications. Browser checks
at 390×844 verified owner inbox scope and opening an own notification marked it
read. The application update prompt also successfully activated the latest PWA
revision. A screenshot captured after deployment is available locally at
`.superpowers/booking-notifications-staging/owner-b-mobile-inbox-final.png`.

## Cleanup and Production boundary

After the user confirmed the phone result, all four synthetic Auth/application
accounts, both QA houses, the synthetic customer, test bookings, notifications and
delivery jobs were removed. Final checks found **zero test bookings, zero QA
users, zero QA houses**, one original linked admin and the original **one Apple
subscription** remaining. The protocol test channels were unregistered.
No existing user's Push subscription was disabled.

Only `refs/heads/staging` was pushed. `refs/heads/main` remained at
`d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1`. No Production workflow was invoked.
The live acceptance harness, raw sanitized results and screenshots remain in the
ignored task directory; no credentials or subscription endpoints were committed.

## Standalone click follow-up

The user confirmed that manually opening the Staging Home Screen icon launches
standalone without a Safari URL bar, while a notification tap opens Safari.
The live manifest was independently checked: `id`, `start_url`, `scope` are `/`
and `display` is `standalone`, so the installed app and detail URL share scope.

The old click handler enumerated all same-origin windows, including uncontrolled
ones, then navigated and focused the first one. Such a window can be an ordinary
Safari tab. The fix calls `clients.openWindow` directly from the notification
event's `waitUntil`, with the fixed same-origin notification URL, and focuses only
the returned window when one is provided. A null result does not fall back to
focusing a Safari tab. Platform launch behavior still needs physical verification.

- Follow-up commit: `2fa1bfb1f9de037511735eb6f073721e2ec9ca46`.
- Two regression cases failed against the old handler, then passed after the fix.
- Targeted worker/PWA tests: eight passed. Independent review: no findings.
- Local verification: 1,221 passed; zero failed; four optional integration skips.
- Staging CI/CD: https://github.com/Chaimanat2546/webook/actions/runs/39772836866

The follow-up CI/CD run succeeded: **1,297 passed, none failed or skipped**.
Worker version: `03b671cd-e85d-4a52-9110-92d2de994f5b`. Live worker bytes matched
the committed artifact, SHA-256
`c979f1ca885a50361de9eefd286bd822350a83685193c73696832ca191ba7b16`.

The user confirmed updating from the installed Home Screen PWA before a new
confirmed test booking (665, inactive QA house DV 99882203) was created. Its single
Apple delivery reached `sent` on attempt 1 at **18:57:36 ICT**. The user reported
that no mobile notification appeared, despite the PWA showing Push enabled.
Provider acceptance alone was not treated as proof of device display. The PWA
showed Push enabled, so the user disabled and re-enabled it from the installed
app. A new, distinct server subscription appeared, while the original binding
remained. This establishes different bindings, but does not prove which browser
or device owned the original registration.

To isolate the new PWA binding, one test delivery for the existing QA notification
was queued only to that new subscription. The deployed scheduled dispatcher sent
it successfully on attempt 1 at **19:03:36 ICT**. The user then confirmed:
**received the notification and opened the PWA without a Safari URL bar**.
This verifies standalone launch for the reconnected PWA on the deployed fix.
It was a targeted replay of the QA event; the original new-booking recipient
matrix was already verified independently above.

After confirmation, booking 665, its notification/delivery rows, the QA house and
synthetic customer were removed. The existing admin account and both device
bindings were retained, including the newly verified PWA subscription. No
Production workflow was invoked; main remained at the SHA recorded above.
Force-quitting the app was not a separate physical-device acceptance scenario.
