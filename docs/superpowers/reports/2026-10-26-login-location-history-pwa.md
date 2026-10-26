# PWA location submission — Staging follow-up

Date: 2026-10-26 (Asia/Bangkok).

The user reported that the iPhone PWA opened but displayed the generic save-failed
message after sharing location. A Staging-only Worker tail observed three location
POST responses with status 404 during the user's reproduction. Only endpoint path,
status and invocation outcome were printed; no request bodies, coordinates, cookies
or account identifiers were logged by the diagnostic harness.

## Reproduction and change

The same stale-context failure was reproduced with fictional accounts in two browser
tabs: leave the first login prompt open, sign in as the same user in the second tab,
then submit from the first. Its history UUID belongs to the earlier session while
the shared cookie now authenticates the newer session. The API correctly rejects
that combination with 404. Previously the UI offered repeated submission of the
same stale payload without a recovery path.

The sign-in redirect now includes a history-specific query value. The page always
resolves the current verified session's record, canonicalizes old/missing query
values and keys the prompt by history UUID to reset prior attempt state. A stale
404 offers a full page navigation to the current prompt. The API's user/session
checks and one terminal report per history are preserved. No migration was added.

The iPhone report's exact browser-cache/session sequence was not directly observed;
the two-tab reproduction establishes the matching failure and recovery path. After
the update and requested sign-out/in retry, the user confirmed “บันทึกได้แล้ว”.

## Evidence

- Three regression tests failed against the previous navigation/state behavior,
  then passed after the change. Thirteen targeted auth/location tests passed.
- Full `npm run verify`: 1,329 passed, 4 skipped, 0 failed; typecheck and lint passed
  with existing warnings. `npm run build` passed with placeholder public config.
- Reviewed the source diff and generated the Service Worker using `build:pwa`.
- Staging commit `3877adeb5e16bdec2edf34a3763ec06afa01153e` was deployed by
  [successful workflow 40308392032](https://github.com/Chaimanat2546/webook/actions/runs/40308392032).
  CI passed its zero-skip integration gate, builds, dry-run and Worker smoke checks.
- The code fix is also pushed to `feature/login-location` at `4c0bfcc` with its own
  generated Service Worker revision, preserving that branch's source composition.
- Twenty live Staging checks passed, including old-URL canonicalization after
  repeated sign-in, old-record rejection and successful current-record persistence.
  Coordinate success used synthetic data rather than the device's location.
- Real browser two-tab reproduction: old prompt → 404 recovery message → full
  navigation to the new prompt → skip saved successfully (HTTP 200).
- The two fictional Auth accounts and cascading test history were removed. Temporary
  credentials were removed, the browser signed out and test tabs were closed.

## Device confirmation

The user confirmed that location could be saved in the iPhone PWA after the update
and requested sign-out/in retry. This confirms the reported device flow; it does
not cover every iOS version or OS permission outcome. No Production changes were made.
