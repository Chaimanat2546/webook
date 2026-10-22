# Booking notifications: Staging deployment — 2026-10-22

## Result

Staging is deployed and ready for physical-device acceptance testing:
https://webook-staging.chaymanus2003.workers.dev

- Successful CI/CD run: https://github.com/Chaimanat2546/webook/actions/runs/39767059658
- Deployed commit: `623b53546e056313b520ee021534356b384ff7f7`
- Cloudflare Worker: `webook-staging`
- Worker version: `66e205af-7b31-44a1-80a1-3086f8d433a6`
- Cloudflare account: `0df55f166fa309dcc904e992c43f86db`
- Supabase: `https://sxvkhzhqtrpxgzumsswl.supabase.co`

The workflow applied `20261022100000_booking_notifications.sql`, prepared runtime
Push secrets, and deployed using `npm run deploy:cf:staging`. The compiled bundle
checks confirmed the Staging Supabase reference is present and the Production
reference is absent. Runtime secrets-file cleanup succeeded.

A distinct VAPID key pair was generated for Staging. `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` were configured in GitHub Environment
`staging` and supplied as Worker runtime secrets without entering the build
environment. Key values are not included in source control or this report.

## Verification

- CI strict integration suite: **1,295 passed; 0 failed; 0 skipped**.
- CI validation and migration/deployment jobs both completed successfully.
- Independent review of the CI changes found no actionable issues.
- Live `/login`: HTTP 200.
- Live `/admin/dashboard` without authentication: HTTP 307 to login.
- Live `/api/notifications` without authentication: HTTP 401, private/no-store.
- Live `/sw.js`: HTTP 200 with Push display/click handlers and bytes matching the
  committed `public/sw.js`.
- Service Worker SHA-256:
  `2e826932be540c4fb46883b157e95fd1af3d0f5b791aaba41bf4ee87bf96a9f0`.

Only `refs/heads/staging` was pushed. Production workflows and configuration were
not changed or invoked. `refs/heads/main` remained at
`d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1`.

The first CI run (`39766853983`) was cancelled during validation after two Worker
source files were found missing from the initial commit. Its deployment job had
no executed steps; no migration or deployment occurred in that run. The files
were committed before the successful run above.

## Mobile acceptance steps

1. Open the Staging URL and sign in as an admin or an owner with the expected DV.
   Apply the application's update prompt if shown so the current Service Worker
   controls the page. On iPhone/iPad, add the website to the Home Screen and open
   it from that icon, following the supported-device guidance in
   `docs/booking-notifications.md`.
2. Open the notification bell and select **เปิดแจ้งเตือนบนอุปกรณ์นี้**. Allow the
   browser/OS notification permission. Repeat on each device/account being tested.
3. Create a new `waiting` or `confirmed` booking. Every eligible admin should
   receive an inbox item; owners should receive it only when the house DV matches
   their account. Accounts must have a linked Supabase Auth user.
4. Background the app or lock the phone and allow roughly one minute for the
   scheduled dispatcher, plus provider/device delivery time. Tap the Push message
   and verify it opens the authorized booking destination.
5. Verify an owner with a different DV receives neither the inbox item nor Push.
   Existing bookings and booking updates do not generate new-booking alerts.

Actual Android/iPhone receipt, OS permission interaction, and viewport appearance
remain to be verified on physical devices. Automated tests and live HTTP checks
do not establish physical-device delivery.

This report was added after deployment. It changes documentation only and does
not require another build or deployment.

Subsequent live acceptance found and fixed a Workers Push transport issue, deployed
the fix to Staging, and verified actual provider receipt and the user's mobile
display/click. See [the live acceptance report](2026-10-22-booking-notifications-staging-acceptance.md)
for the final tested revision and fixture cleanup.
