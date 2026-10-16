# Daily time window analytics — verification

Date: 2026-10-16 (Asia/Bangkok)

## Result

Implemented locally in baan-pool-villa and Webook on `codex/daily-time-window-plan`. No commit, remote migration, PR or deployment performed.

API 1.2 filters `[from_time,to_time)` independently on every selected Bangkok date. One day uses the existing 1.1 hourly contract; multiple days return daily totals. Existing 1.0 callers retain full-day behavior. Unsupported 1.2 sources show an explicit failure, without silently substituting full-day totals.

Webook reuses the existing picker and moves time fields directly below the calendar. Applying commits dates and clocks together; cancel, Escape and outside click discard drafts. Controls remain 32px; month navigation is 32×32px. Comparisons with different daily clock windows suppress total percentages.

## Automated checks

| Project | Check | Result |
| --- | --- | --- |
| baan-pool-villa | npm test | 286 files, 2,438 tests passed |
| baan-pool-villa | build / lint / tsc --noEmit | Passed |
| baan-pool-villa | disposable PostgreSQL migration and SQL suite | Passed, including upgrade replay and legacy/hourly regression |
| Webook | npm run build | Passed, regenerated PWA worker |
| Webook | npm run verify | Passed: typecheck, lint, 1,070 tests passed / 4 skipped / 0 failed |
| Cross-project | real producer SQL → HTTP authorization → consumer services | Passed |

Webook lint reports 11 existing warnings in unrelated booking/image/navigation/worker files, with zero errors. The first verify attempt detected a stale generated PWA fingerprint; the final build regenerated it and final verify passed.

Coverage includes exact start/end boundaries, 24:00, microsecond retention, incomplete/future windows, 90/91/180-day chunking, failed chunks, zero versus unavailable data, invalid API echoes and authorization. A failed first site no longer hides another site's valid daily graph axis; regression test and reviewer recheck passed.

## Browser checks

Actual project components rendered against a local disposable PostgreSQL/HTTP fixture, using Edge. These checks are local, not Staging or Production smoke tests.

- Desktop 1280×900: time fields below the calendar in its own column; 32px controls and 32×32 month arrows.
- Mobile 360×800, 390×844, 430×932: no horizontal page overflow; scrollable popup; time fields accessible below calendar. At 430px the clock control measured 32px after transition settled; keyboard navigation reaches it.
- Oct 12–14 / 09:00–18:00: daily `[2,2,2]`, total 6. Draft 10:00 did not load data; Apply loaded once and changed daily totals to `[1,1,1]` for 10:00–18:00.
- 10:00–24:00: daily `[2,2,2]`, total 6. Invalid equal/reversed clocks disable Apply.
- Cancel, Escape and outside click restored committed clocks. Switching between one day and a range preserved draft clocks.
- Independent comparison clocks retained; mismatch notice visible and total percentage suppressed.
- Website detail and all-house navigation preserved clocks and filtered totals. House search input measured 32px. Selecting Oct 14 retained 10:00–24:00, total 2, and returning to overview displayed the hourly chart.

Screenshots are saved in the task visualization directory: `daily-window-desktop.png`, `daily-window-mobile-360.png`, `daily-window-mobile-430.png`.

## Rollout dependency

Apply and verify the producer migration/API before enabling the Webook deployment. The API upgrade has not been applied to any remote database in this task.

## Follow-up: optional clock selection

User approved the bounded design: an existing 32px Button labelled **ระบุช่วงเวลา** toggles the clock fields below the calendar. Off means full day 00:00–24:00, including when reopening an explicit full-day URL. Narrower ranges reopen enabled. Turning off clears draft hours; Apply commits full-day bounds, while cancellation restores the previous committed state. Existing API contracts are unchanged.

Verification: focused tests failed before implementation and passed after it; final `npm run build` and `npm run verify` passed (1,070 passed, 4 skipped, zero failures; same 11 existing lint warnings). Real producer SQL/HTTP integration passed again. Edge browser verified custom 09–18 total 6 → disabled/full-day total 12 for three days, no load before Apply, cancellation restoring 09–18, keyboard toggle, and single-day full-day total 4 with hourly chart. Desktop 1280px and mobile 360/390/430px tested; toggle, clock selectors and month arrows remain 32px after transitions settle, with no horizontal overflow. Screenshots: `optional-time-desktop.png`, `optional-time-mobile-360.png`, `optional-time-mobile-enabled.png`, `optional-time-mobile-430.png`. Tests use local disposable fixtures; no remote deployment performed.
