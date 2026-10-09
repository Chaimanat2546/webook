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
