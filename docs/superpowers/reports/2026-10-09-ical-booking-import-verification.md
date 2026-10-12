# Airbnb calendar import verification

Implementation and local verification are available in the managed
`ical-booking-import` worktree. No application database migration, source creation,
remote deployment, commit or push was performed. The user changed the initial
provider from Agoda to Airbnb; other provider values remain schema-only support.

## Implemented scope

The 13-column source table and two booking linkage columns preserve existing
internal booking types. Secure fetching, AES-GCM URL storage, full-snapshot parsing,
transactional upserts/cancellation and source leases feed the booking gallery.
The per-house source workspace uses the existing House Workspace Shell and
Button/Input/Label primitives. Source mutation requires booking permission and
role 1; imported bookings are read-only and excluded from dashboard reporting.

Refresh is awaited, on demand, with 300-second freshness, 60-second failure cooldown,
30-second leases, an 8-second fetch/read limit, a 1 MiB feed limit and 5,000 events.
Each action attempts at most six due sources, with three in flight. There is no
iCal cron, OTA export, customer import or price/payment synchronization.

## Schema and live feed evidence

Staging structure was read using the existing Staging connection, without remote
writes or customer-data queries. The current bookings schema has bigint identity
IDs, required unique booking codes, date boundaries, nullable customer/agent fields,
neutral monetary defaults and an active-booking GiST exclusion. The migration
preserves internal/internal exclusion and allows imported snapshots to expose
conflicts. New or moved internal stays cannot bypass imported occupancy; unchanged
active stays remain editable. The reporting amendment checks its expected SQL
anchor and fails rather than guessing if the target report differs.

The supplied Airbnb endpoint returned HTTP 200, 3,581 bytes and 16 all-day events
during the live format check. DTSTART/DTEND used VALUE=DATE; no recurrence was seen
in this sample. No source URL, token, UID, guest text or raw feed was saved to Git.
This establishes the observed feed shape, not a live authenticated application
import or a guarantee about every Airbnb export.

## Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 0 errors and 11 existing warnings |
| `npm test` with both integration flags enabled | 953 total, 952 passed, 0 failed, 1 existing skip |
| `npm run build` | Passed; includes the calendar-sources route |
| Disposable PostgreSQL 17 integration | Passed |
| Local Workers integration using installed Miniflare | Passed |

The DB integration executes the new migration alongside the existing booking
update/create RPC migration and dashboard migration on a verified structural
subset. It tests concurrent lease claims, expired-token rejection/takeover,
atomic rollback, UID updates and source separation, foreign-house rejection,
URL replacement invalidation, empty snapshots, disable/cooldown behavior,
anonymous/authenticated access denial, old RPC read-only enforcement, report
exclusion and unchanged-snapshot audit volume. The audit fixture models actor
attribution; it does not reproduce the entire deployed audit/RLS topology.

Workers verification bundles and executes the actual parser, fetch adapter and
secret module using Staging's compatibility date/flags. It exercises Web Crypto,
server environment access and streamed synthetic responses. It has no remote
bindings and does not verify outbound Airbnb connectivity from a deployed Worker
or the whole OpenNext bundle. The test uses the installed Miniflare 5 configuration
contract rather than older constructor examples. See
[Cloudflare Miniflare documentation](https://developers.cloudflare.com/workers/testing/miniflare/).

The generated PWA worker was rebuilt by the normal build command. Existing PWA
revision tests pass. No unrelated lint warnings or dependency-audit findings were
automatically repaired.

## Review findings and rulings

1. Important: malformed or unsupported calendar topology could masquerade as an
   empty snapshot. Fixed with component-stack validation and rejection of partial
   scheduling METHODs. New negative tests failed before the fix and pass afterward.
2. Important: source replacement between list and claim could fetch old config
   under a new lease. Fixed by atomically returning the current source with the
   winning token, then fetching that config. Regression failed before the fix.
3. Important: external overlap blocked editing unchanged internal dates in the
   editor. Fixed by ignoring external conflicts only for an unchanged active stay.
   New or changed dates still detect external occupancy. Regression failed before
   the fix; DB integration also enforces the new/moved-stay boundary.
4. Minor, deferred: all overlapping events are stored and represented in day
   summaries, but the details interaction selects the internal booking first or
   the first external entry. A per-source overlapping-event selector and richer
   read-only provenance/freshness details remain future UI work.
5. Limited review evidence: Staging structure and disposable DB tests support the
   migration contract; Production compatibility, deployed audit/RLS behavior,
   real browser interactions and deployed Workers requests remain release checks.
   Expired leases, rollback, house substitution, existing RPC protection and audit
   attribution were subsequently covered locally as described above.

## Remaining release checks

- Configure a stable server-only encryption key and securely retain its backup.
- Recheck the selected central target's current structural metadata before applying
  the migration. Production is not an approved deployment target in this task.
- Release schema, guards, report filtering and app code together; do not start
  import against an old app/report version.
- Test authenticated source add/edit/toggle/refresh and gallery/editor interactions
  on desktop, mobile and keyboard in Staging. No authenticated browser QA was run.
- Confirm real Airbnb fetch and refresh from the deployed Staging Worker and compare
  imported date ranges with the provider calendar without exposing tokenized URLs.

The local feature is ready for Staging acceptance, not yet verified as a deployed
or Production-ready integration. Setup and operator behavior are documented in
`docs/ical-booking-import.md` and `.env.example`.

## Staging follow-up: read-only calendar details

The earlier acceptance gaps above describe the initial feature checkpoint.
The subsequent Staging checks confirmed a real Airbnb sync for test house
DV 990001: 16 imported UIDs, no cross-house rows, and read-only details.
Production was not touched.

The detail dialog now uses the existing calendar day renderer with a read-only
mode, a desktop two-column layout, and a single-column mobile/Sheet layout.
The right-hand panel shows source, Thai check-in/out dates, exclusive-checkout
nights, status, notes and actual Bangkok sync time. No customer values,
feed URL, agency selector, save or cancel-booking control is displayed.

Browser checks on Staging observed desktop 1280px, mobile 360px, month navigation,
no horizontal dialog overflow, and Escape returning focus to the selected day.
Automated UI tests cover read-only days, exact selected dates, cross-month
checkout exclusion, cancelled/failed states, and reloading the selected booking
after refresh so a new sync timestamp is not paired with stale details.
Code review identified the stale-snapshot case; it was fixed and re-reviewed
without remaining Important/Critical findings. A real screen-reader session
and all error/empty-state browser scenarios were not exercised.

Final local verification: typecheck passed; lint 0 errors/11 existing warnings;
966 tests total, 962 passed, 0 failed, 4 opt-in/existing skips.
# Shared calendar revision — 2026-10-09

- User approved one Dialog and one left calendar component for internal and iCal bookings.
- Both branches now reuse `BookingEditorLayout` and `BookingDateRange`; only right-hand details and allowed actions differ. Removed the separate iCal calendar grid/styles.
- Read-only date-cell test observed failure for date mutation, then passed after the guard; accessibility regression observed the incorrect free-night label before correction.
- `npm run build:pwa` + `npm run verify`: exit 0; 967 tests, 963 passed, 0 failed, 4 skipped; lint 0 errors and 11 existing warnings. Updated the moved-layout assertion to render the shared component.
- Reviewer found no Critical/Important issues; minor selected-night accessible name corrected and tested.
- `npm run deploy:cf:staging`: exit 0; Worker version `56c421cb-6fd4-4194-a47a-22a3b31076eb`. Compiled bundle includes Staging Supabase reference, not Production.
- Browser: internal calendar/date controls and customer/price/save form remain present; iCal uses same calendar with 35 disabled date buttons and no save. At 360px, dialog width 345px, single column and no horizontal overflow; Escape returned focus to the trigger. No booking was created, edited or cancelled during UI checks.
- Code remains uncommitted/unpushed; no Production deployment. Full screen-reader and real-device testing not performed.

## House calendar settings and Airbnb identity — 2026-10-09

- Airbnb provider row now uses installed `SiAirbnb`; other providers keep the calendar fallback.
- Settings moved into `/admin/houses/[id]?section=calendar` using the existing house shell/category navigation, with label “เชื่อมปฏิทินภายนอก”. Legacy route authorizes then redirects.
- Removed gallery settings link. Added desktop/mobile house-list entries gated by role 1 and booking permission, preserving returnTo. Server authorization still checks auth.uid before reading source data.
- Form labels use everyday Thai. Feed input stays masked, with new-password autocomplete to avoid saved-login autofill; final browser check found both fields empty without printing their values.
- TDD observed missing Airbnb SVG, missing booking-only list entries, and autocomplete regression before fixes. Real SSR tests cover the shared shell/nav, permission rejection before data reads, both list entries, and brand-icon fallback.
- Final verify exit 0: 971 tests, 967 passed, 0 failed, 4 skipped. Typecheck passed; lint 0 errors/11 existing warnings. Reviewer entry-gap finding fixed and re-review approved.
- Staging deploy exit 0; version `0545dd41-1d8c-421a-9ade-1dbcf1f02d87`. Browser verified house-to-calendar navigation, legacy redirect, and 360px no horizontal overflow. No feed or booking was saved, disabled or cancelled.
- Uncommitted/unpushed; no Production deployment. Cross-browser autofill and real-device testing remain unverified.

## Restore original house-list presentation — 2026-10-09

- Removed the visible desktop calendar link and standalone mobile button. Calendar action now lives inside the existing three-dot dropdown and mobile management Sheet; no changes to table/card layout classes or columns.
- Regression first failed because closed menus exposed additional calendar controls, then passed after moving both entries inside existing menus. Both menu destinations preserve property ID/returnTo and remain permission-gated.
- Relevant 12 tests and typecheck passed; final verify exit 0: 971 tests, 967 passed, 0 failed, 4 skipped; lint 0 errors/11 existing warnings. Scoped reviewer approved with no remaining findings.
- Staging deploy exit 0, version `3440282a-4ff9-41f8-b592-ccacd8dd39d8`; bundle includes Staging reference and no Production reference. Uncommitted/unpushed; no Production operations.
- Staging browser verified the closed desktop table contains only the original three-dot action; the calendar entry appears inside its dropdown. At 360px the card retains its original management button, with the calendar entry inside the management Sheet. Both destinations target the correct house and preserve returnTo. Screenshots saved; viewport reset. No booking/source data was modified during these checks.
