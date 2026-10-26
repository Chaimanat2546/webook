# Login location history — Staging acceptance

Date: 2026-10-26 (Asia/Bangkok).

## Source and deployment

- Combined the login-history implementation with requested commit
  `6e68aab4d1f7f8ae3f54cdc4a72f2d809588ac10` at `552ba05118da92034654c718d4795e08e589549c`.
  Fast-forwarded and pushed `feature/login-location`; no change to `main`.
- Preserved Staging's existing agency/house dashboard work in integration commit
  `fd7b64ccd245a6a4d6b77d69a102b9962b5b5ed0`, then pushed that commit to `staging`.
- [Deploy staging run 40304447743](https://github.com/Chaimanat2546/webook/actions/runs/40304447743)
  completed successfully, including the zero-skip integration gate, both builds,
  Worker dry-run/local smoke, migrations, deployment and compiled target checks.
- Supabase: `https://sxvkhzhqtrpxgzumsswl.supabase.co`.
  Cloudflare account: `0df55f166fa309dcc904e992c43f86db`, Worker `webook-staging`.
  Web: <https://webook-staging.chaymanus2003.workers.dev>.
  No Production migration or deployment was performed.

## Verification

- Current-branch merge: `npm run verify` — 1,324 passed, 4 skipped, 0 failed;
  `npm run build` passed with placeholder public configuration.
- Staging integration merge: `npm run verify` — 1,326 passed, 4 skipped, 0 failed;
  `npm run build` passed. CI subsequently ran its integration gate without skips.
- Two fictional accounts exercised the real deployed sign-in action and API.
  Seventeen acceptance checks passed:
  sign-in history with trusted edge IP; refresh without duplicate logs;
  anonymous and foreign-Origin denial; cross-account write denial;
  invalid-coordinate rejection; skip persistence, identical replay and conflict;
  synthetic-coordinate success; own-only RLS; hidden other-user records;
  blocked direct history writes; blocked cleanup RPC;
  own history rendering; blocked direct role escalation;
  different-session denial; no extra audit from Auth session activity;
  and revoked-session rejection despite retaining the old token.
- A third fictional Auth account was created after migrations, then used in the
  browser: sign in → explanation → skip → normal no-module-access landing → own
  history. The history page displayed one Chrome/Windows record with status
  “ผู้ใช้ข้าม”. A profile mapping is not required to read one's own history.
- All three task-created Auth users and their cascading test history were removed
  after verification. The temporary credentials file was removed. Browser signed
  out and temporary tabs were closed. No real device coordinates were collected.

## Remaining checks

- Actual Android/iOS/PWA permission acceptance, denial, unavailable and timeout.
- Root administrator history UI and normal member-management edits with an
  authorized existing administrator. No privileged test profile was created.
- Complete remote catalog audit of legacy user-writing functions/grants: the
  local Staging database connection failed authentication; the stored credential
  was not changed. CI migration success and HTTP permission checks do not replace
  this broader audit. Auth account creation after migration was verified.
- Management's location rules, retention and backup policy remain rollout items.
  Location is optional; no booking/payment requirement was enabled.

Task-only smoke harness/output remain in the ignored
`.superpowers/sdd/2026-10-26-login-location-history/` directory without credentials.
Screenshots outside the repository show the deployed prompt and post-skip landing.
