# Login / optional location / History UI verification

Date: 2026-10-28 (Asia/Bangkok)

Branch: `codex/login-history-ui`, based on Staging commit `a50a2ea1da448407c2aa180a75bb11596e1fa746`.

## Delivered behavior

- UI01 follows the supplied normal/submitting/invalid frames, including original transparent logo, labelled inputs, password visibility, password-manager autocomplete, pending-disabled controls, preserved identifier and distinct inline credential/transport errors.
- UI02 uses the brief optional question/actions. Skip dispatches its existing report and continues immediately; permission outcomes continue after classification without awaiting persistence. Keepalive saves survive route unmount; failed writes leave `pending`. There is no retry/result/technical screen, numeric retention disclosure or location toast. The Staging probe route/links and Login install promotion are removed from this journey.
- History viewing is root-only in navigation, page/service/repository, RLS and the listing RPC. Collection remains available to the owner of any signed-in session. No table, column or location status is added.
- UI04 has the scoped branded header, Bangkok-day journal, separate search/date controls, mobile status/order Sheet, desktop Popover, deterministic pagination and computed range helper. Its loading, default empty, filtered empty, date error and load failure retain context and correction controls.
- Date errors focus the actual responsive control; previously loaded records stay explicitly labelled as the previous search. Ambiguous duplicate criteria are rejected while keeping visible values for correction.
- Royal/Azure roles apply to these screens and their portalled controls; unrelated modules keep their existing theme. Plus Jakarta Sans is bundled with its OFL license and the existing Noto Sans Thai fallback. The original logo asset is unchanged. Existing retention cleanup remains unchanged, without a numeric retention claim in the product UI.

## Automated checks

| Check | Observed result |
| --- | --- |
| Full Node suite after review behavior fixes, concurrency 2 | 1,345 passed, 4 skipped, 0 failed (1,349 tests) |
| Relevant Login/History/PWA checks after final visual adjustments | 84 passed, 0 failed |
| Strict TypeScript | Passed; final production build also completed its TypeScript phase |
| ESLint after final changes | Exit 0; 11 existing warnings outside the changed feature |
| `npm run build` after final changes | Exit 0; webpack production build using fictional loopback-only Supabase configuration |
| `git diff --check` | Passed |

No environment secrets were printed or used for the preview. No remote account, database, migration or deployment was touched. Existing installed dependencies were reused through a node_modules junction after npm ci failed from host memory pressure; package.json and lockfile are unchanged. Tests used bounded concurrency to reduce host memory use.

## Production-build browser checks

The actual built Next.js app ran against a dedicated fictional HTTP Auth/data fixture on loopback. Chromium browser contexts used CSP bypass solely to reach that local fixture; production CSP was not relaxed. Service workers were blocked in the primary UI checks so cached assets could not mask the current implementation. These are application integration checks, not proof of a live Supabase deployment.

Observed all of the following:

- Login normal, invalid and submitting; show/hide preserves password; invalid credentials preserve identifier; fields disable while submitting.
- Skip navigates while the deliberately delayed save is unresolved, with no visible save result.
- Chromium geolocation success and denial, plus simulated unavailable/timeout/unsupported callbacks, all dispatch the appropriate existing category and continue without a result screen.
- History records, loading, default empty, filtered empty, invalid date and load failure; status/order Sheet; pagination resetting/retaining criteria; clear; same-criteria retry.
- Non-root direct History navigation returns forbidden content; an expired session returns to Login with its dedicated message.
- Invalid-date server response focuses the date control after responsive hydration. Navigating back from valid records to invalid criteria retains labelled previous records.
- Sheet/calendar Escape restores trigger focus; the portalled calendar resolves primary to `#2F3EE8`.
- No horizontal overflow in the captured states at 390px/360px. Login card measures 320×463px, matching native normal frame `w1XFH`. Loading and form states have nonvisual status markup and meaningful labels.
- Desktop layout at 1280px and a 640×450 reflow viewport equivalent to 200% zoom on that desktop size. This was a reflow check, not a manual browser zoom or screen-reader audit.
- Primary smoke run reported no uncaught page errors.

Screenshots are retained outside the worktree scratch directory:

`C:/Users/chaym/.codex/visualizations/2026/10/28/01a181b8-9524-76e1-adec-aa8b80990172/login-history-ui/`

Representative files: `login-normal-390.png`, `login-invalid-390.png`, `login-submitting-390.png`, `location-390.png`, `history-records-390.png`, `history-filter-sheet-390.png`, `history-loading-390.png`, `history-empty-390.png`, `history-filtered-empty-390.png`, `history-invalid-date-390.png`, `history-load-failure-390.png`, `history-records-360.png`, `history-calendar-360.png` and `history-records-desktop.png`.

## Review and regressions

A fresh reviewer inspected the complete working change against the approved design and plan. No Critical issue was found. Three P2 issues were reproduced and fixed: duplicate criteria disappearing, same-account session replacement not cancelling stale collection, and invalid-date transitions losing the last valid rows. Initial date-error focus was included in the date-correction fix, including the responsive trigger replacement. Unit regressions failed before their fixes and passed afterwards; the browser regression initially reported missing focus/previous records and now reports both present. The SQL fixture was also corrected to provide the success row's required received timestamp.

The review fix pass was verified by tests and browser checks, without a second independent review. No deferred minor findings or declined-to-judge items remain.

## Database verification limit and rollout

**The SQL suites were not executed in this session:** the Docker CLI could not connect to its local daemon, and no local PostgreSQL server was available. The new SQL assertions cover root-only reads (including the default six-argument listing call), seven statuses, complete-dataset totals, page boundaries, both time directions and UUID ties. Existing SQL assertions were updated for the approved removal of self-history reads. Static review is not a substitute for running these suites.

Before any deployment, run `node scripts/test-login-history-db.mjs` against the documented isolated local test database and validate the complete Staging schema. Apply the new migration `20261028100000_login_history_root_filters.sql` after the existing role-guard/history migrations; the updated app passes the new listing arguments. Physical Android/iOS/PWA permission behavior and formal accessibility/screen-reader verification remain device/rollout checks.

No merge, push, remote migration or deployment was performed. Keep the attached branch/worktree available for review.
