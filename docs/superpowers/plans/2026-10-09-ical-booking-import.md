# iCal Booking Import Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Delegate only if the user explicitly selects delegation.

**Goal:** Import Airbnb availability into the existing central `bookings` table and show unavailable dates in the admin calendar, with database support for multiple iCal sources per house. The user changed the initial provider from Agoda to Airbnb on 2026-10-09 after supplying an Airbnb test feed; references to Agoda below describe the original plan and now apply to Airbnb for execution.

**Architecture:** Server Actions authorize the operator, services fetch and normalize iCal, and repositories call transactional Supabase RPCs. One new source table owns encrypted URLs, cache freshness and distributed leases. Existing bookings reference their source and external event UID.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase PostgreSQL, Cloudflare Workers/OpenNext, `ical.js`, Node.js Test Runner.

**Design basis:** The decisions below capture the agreed chat requirements and refine the attached `ical-sync-concept.md`. This plan is for review before implementation; no deployment is authorized by it.

## Execution status

Local implementation uses Airbnb as explicitly selected by the user. The historical
Agoda references below are superseded for this execution. Tasks 1–5 have local code
and verification evidence; authenticated browser and deployed Staging acceptance
remain open. Task 6 local typecheck/lint/tests/build and documentation are complete.
The implementation adds a six-source cap per action while keeping three concurrent
fetches. A winning lease includes its atomic source configuration, not just a token.
See [verification and release checks](../reports/2026-10-09-ical-booking-import-verification.md)
for exact test coverage, review rulings and unfinished acceptance checks. No commit,
remote migration or deployment is authorized or claimed by this execution.

## Global Constraints

- Store sources and imported bookings in central Supabase alongside `listings` and `bookings`.
- Start with Agoda ingestion. Multiple providers and multiple URLs from the same provider must fit the schema without a later structural migration.
- Import availability only; no OTA export, payment, customer or price synchronization.
- Preserve existing `booking_type` values. Inspect its real constraints before adding provider values; do not rewrite internal bookings to an invented `internal` value.
- New migrations only. Do not modify historical migrations or run Production writes.
- Privileged access is server-only; strict TypeScript, no `any` and no plaintext URL logging.
- Use existing booking permission checks. Existing bookings RLS remains unchanged; the new source table has RLS enabled and no direct anon/authenticated access.
- Read relevant installed Next.js documentation before implementing route/action code.
- Staging deployment, if separately requested, uses `npm run deploy:cf:staging` and verified environment targets.

## Proposed Design

### Database

Create `public.property_calendar_sources`:

| Field | Contract |
| --- | --- |
| `id` | UUID primary key |
| `listing_id` | Non-null FK to `listings.id` |
| `provider` | Text: `agoda`, `airbnb`, `booking_com`, `other`; only Agoda can be enabled by MVP actions |
| `label` | Trimmed name, 1–120 characters |
| `ical_url_encrypted` | Authenticated encrypted payload including key version, server-only; key itself is outside DB |
| `enabled` | Boolean, defaults true |
| `last_attempted_at`, `last_synced_at` | Nullable timestamptz; attempt and successful snapshot are distinct |
| `next_refresh_at` | Nullable timestamptz; freshness/retry eligibility per source |
| `last_error_code` | Safe code for latest completed attempt, never raw URL/provider response; cleared on success |
| `sync_lease_token`, `sync_lease_expires_at` | Nullable UUID/timestamptz pair for distributed lease |
| `created_at` | Source creation timestamp |

The agreed MVP source table has exactly 13 columns. No separate encryption-key-version, error timestamp, creator or general update timestamp is required. Keep the encryption key version inside the encrypted payload envelope. `last_attempted_at` identifies the attempt associated with `last_error_code`; clear the previous error when claiming a new attempt, then record its result only under the owning lease. Do not present the attempt timestamp as an exact error occurrence time.

Do not add uniqueness on `(listing_id, provider)` or label: a house can have multiple Agoda URLs. Index `(listing_id, enabled)` and use `id` to identify each connection.

Add only `calendar_source_id uuid null` and `external_uid text null` to `bookings`:

- FK source deletion uses RESTRICT; disabling a source preserves provenance.
- CHECK: both new fields are null together or populated together; non-empty external UID.
- Partial UNIQUE `(calendar_source_id, external_uid)` for imported bookings.
- Imported row's `listing_id` must match its source. Enforce in DB through a composite FK where practical, otherwise a checked trigger; derive `houseid` from that listing inside the sync RPC.
- Use existing `booking_type` for provider identity after metadata verification. Source linkage is the authoritative test for imported rows, including edit/report guards.
- Active imported rows use existing `confirmed` status for calendar compatibility, but UI calls them “ไม่ว่างจาก Agoda”. Cancelled/missing events use `cancelled`.
- Imported rows have no customer, agent or payment deadline. Required monetary fields use neutral values verified against the schema; these rows are excluded from business reports.

### Sync policy

- Refresh only sources for houses currently opened in the calendar/gallery; do not scan all ~2,000 houses.
- Successful snapshot freshness: 300 seconds. Failed attempts: retry cooldown 60 seconds. Manual refresh observes the cooldown and lease.
- Claim a per-source lease atomically in PostgreSQL, expiry 30 seconds. Completion requires the same unexpired token; late workers cannot overwrite newer results.
- Fetch outside a database transaction, with HTTPS, exact provider host allowlist, port 443/default, no userinfo/IP literals and redirects rejected. Do not offer arbitrary `other` URLs in MVP.
- Limits: total fetch/read deadline 8 seconds, decoded body 1 MiB, maximum 5,000 VEVENTs, maximum 3 concurrent source fetches per request. Check limits while reading rather than after `response.text()` has allocated everything.
- Parse complete snapshot before writing. An unsupported or malformed event rejects the snapshot rather than silently cancelling absent rows.
- MVP accepts standalone all-day VEVENTs with valid UID/start/end and exclusive DTEND. Missing DTEND follows RFC all-day default of one day. Explicit CANCELLED events cancel matching rows. Reject recurrence and timed events until the sanitized Agoda sample establishes a tested conversion contract.
- A valid complete calendar with zero events is an empty successful snapshot; replace source rows accordingly. A partial/truncated response is a failure and preserves prior rows.
- Apply upserts and cancellation of missing active rows in one transaction for that source. Success updates freshness and clears errors in the same transaction. Failure records a safe code and preserves bookings/last successful time.
- Multiple sources may overlap each other or internal bookings. Preserve all imported rows and show conflict; do not deduplicate across sources based on dates. Existing internal overlap rules must remain intact.
- Initial load with no snapshot shows “ยังไม่มีข้อมูลจาก Agoda”, not verified availability. Existing snapshots remain visible on errors with freshness/error status. Use bounded awaited refresh in MVP; background refresh requires a separately validated Worker lifetime mechanism.
- Disabling a source atomically cancels its imported active rows and stops refresh. Re-enabling forces refresh; failed refresh must not reactivate cancelled rows. URL replacement cancels old imported rows and invalidates freshness atomically before the new snapshot is accepted.

### UI and permissions

- Reuse calendar/gallery components and existing UI primitives. Present reuse choices before UI implementation as required by AGENTS.md.
- Per-house source management uses HouseTaskHeader/HouseWorkspaceShell; read the shell design before implementation.
- MVP source management is role_id=1 only; viewing calendars/triggering bounded refresh uses the existing allow_booking guard. Source secrets never appear in list responses or edit inputs.
- List source label/provider/enabled/last-success/error. Adding or replacing URL uses a blank secret input, with no plaintext echo.
- Imported calendar entries show provider, dates, read-only provenance and sync freshness. Reject edit/cancel on server and in existing booking RPCs as well as hiding controls.
- Gallery day summaries preserve internal booking editing when external events overlap; imported-only cells open read-only details. Show overlapping sources/conflict rather than allowing iteration order to overwrite a day.
- Exclude source-linked rows from dashboard totals, agency statistics, booking lists/detail and any other business analytics queries. Calendar occupancy may include them with clear unavailable-date wording.

## Review Focus

1. Existing metadata differs from the migration baseline: no guessed migration or destructive reconciliation.
2. Empty, malformed, unsupported or failed feeds: only a validated complete snapshot may cancel missing rows.
3. Two concurrent refreshes or an expired worker: late completion cannot overwrite the winning snapshot.
4. Multiple sources and internal overlaps: every event remains traceable and internal booking actions/reports stay correct.
5. Tokenized URLs and substituted source IDs: no secret leakage or unauthorized source mutation.

## File Map

- New migration(s): `supabase/migrations/<execution_timestamp>_ical_booking_import.sql`; optional separate reporting migration.
- New contracts/normalization: `lib/ical-calendar.ts`, `server/calendar/parse-ical.ts`.
- New server integrations: `server/calendar/source-secret.ts`, `server/calendar/fetch-ical.ts`, `server/calendar/providers.ts`.
- New access/orchestration: `server/auth/calendar-sources.ts`, `server/repositories/calendar-sources.ts`, `server/services/calendar-sync.ts`.
- Modify booking data/services: `server/repositories/house-bookings.ts`, `server/services/house-bookings.ts`, `lib/house-bookings.ts`, `lib/booking-gallery.ts`.
- Modify actions: `app/admin/bookings/actions.ts`, `app/admin/houses/[propertyId]/bookings/actions.ts`.
- New source workspace: `app/admin/houses/[propertyId]/calendar-sources/page.tsx`, `actions.ts`, `components/admin/houses/calendar-sources.tsx`; update house navigation.
- Modify gallery/editor components under `components/admin/bookings/` and existing per-house booking components under `components/admin/houses/bookings/` if still routed/used.
- Modify reporting through a new migration replacing current `dashboard_report`; inspect any direct query in `server/repositories/dashboard.ts` and analytics integrations.
- Tests: `tests/ical-*.test.ts`, existing booking/gallery/dashboard regression tests, synthetic ICS fixtures and transactional SQL integration tests.
- Docs: `README.md`, `.env.example`, feature verification report; never save live iCal URL or raw private ICS.

## Execution Order and Release Gate

Implement inline in this order: Task 1 metadata/input verification → Task 2 database → Task 3 parser/fetch → Task 4 orchestration → Task 5 calendar/reporting → Task 6 acceptance checks.

Keep source creation and refresh entry points unexposed until imported-row edit guards and reporting filters are deployed together. Tasks 2–4 may use synthetic fixtures in a disposable DB, but must not insert live iCal rows into an application database running the old dashboard or editable booking UI. Ship schema, guards, reporting and application code as one coordinated feature release.

| Milestone | Reviewable result | Exit criterion |
| --- | --- | --- |
| 1. Compatibility | Structural report + sanitized Agoda fixture | Verified booking defaults/type/overlap/audit contract; actual Agoda hostname known |
| 2. Persistence | 13-column source table + two booking columns + RPCs | Atomic replacement, UID uniqueness, house integrity and lease tests pass |
| 3. Integration | Secure fetch/encryption/parser + sync service | Repeated/failed/concurrent refresh tests pass on Node and Workers runtime |
| 4. Application | Source management + read-only external calendar + report filters | Imported dates visible; internal editing preserved; reports unchanged by imports |
| 5. Acceptance | End-to-end evidence + documentation | Typecheck, lint, tests and build pass; live Agoda verification distinguished from fixture tests |

Authoritative DB access and the test URL are implementation inputs, not prerequisites for reviewing this plan. If either is missing, continue independent fixture/parser work, but do not guess provider hostnames, database constraints or live-provider compatibility.

The 13-column schema and two booking linkage columns are approved. Role_id=1 source management, awaited refresh, numeric limits and disable/URL-replacement cancellation behavior are proposed implementation defaults from this plan, not separately approved product requirements. Resolve any user steering before dependent work.

## Verification Commands

Run focused checks as each task lands:

```powershell
node --import ./tests/register-server-only.mjs --test "tests/ical-*.test.ts"
```

Add named cases in the owning test file: `ical-schema.test.ts` (linkage/defaults), `ical-parser.test.ts` (normalization), `ical-fetch.test.ts` (bounds), `ical-source-secret.test.ts` (encryption), `ical-sync.test.ts` (freshness/leases), `ical-actions.test.ts` (authorization), `ical-calendar.test.ts` (read-only/overlap), `ical-reporting.test.ts` (business exclusions). Transaction and concurrent lease assertions must execute SQL against a disposable compatible database; source-text assertions alone do not prove these behaviors. Use the existing booking/dashboard regression suite and the full completion commands in Task 6.

## Task 1: Verify the schema and Agoda input contract

**Deliverable:** Structural metadata report and sanitized fixture establishing an implementable migration/parser contract.

- [ ] Inspect available read-only database access and obtain columns, defaults, checks, FKs, exclusion indexes, triggers/audit and booking RPC definitions for the intended central schema and Staging. Capture structure only.
- [ ] Inspect existing `booking_type` values and constraints, code-generation rules and nullability of imported row fields. Resolve compatibility in the report without changing existing internal values.
- [ ] Inspect overlap rules; design a source-row exemption only where necessary while preserving internal rules. If no authoritative metadata access is available, record the exact blocker and stop dependent migration implementation.
- [ ] Obtain the user's Agoda test URL privately or a sanitized ICS fixture. Confirm the actual export hostname, all-day/date semantics, UID, cancellation and recurrence behavior. Never commit URL, guest text or token.
- [ ] Add fixture contract tests for exclusive checkout and rejection of unsupported event forms. If Agoda requires timed/recurring support, revise this plan's conversion/identity contract before proceeding.
- [ ] Review report against the schema design; record any necessary adjustments and stage-only validation strategy.

## Task 2: Source schema and transactional snapshot writes

**Interfaces:** Repository methods `claim(sourceId, now): Promise<Lease | null>`, `applySnapshot(lease, events): Promise<void>`, `recordFailure(lease, code): Promise<void>`; a `Lease` contains source ID/token and expiry. `CalendarEvent` contains UID, start/endExclusive and active/cancelled status.

- [ ] Write DB integration cases: two claims yield one winner; foreign-house linkage fails; duplicate source/UID updates one booking; same UID in different sources remains separate; expired token completion fails; rollback preserves previous snapshot.
- [ ] Run cases against a disposable compatible DB and confirm expected missing-schema/RPC failures.
- [ ] Write new migrations for the source table, booking linkage, integrity, service-only RPC execution, source lifecycle and immutable imported-row guards. Keep lease/row writes atomic and preserve current audit attribution without duplicate logs.
- [ ] Test missing-event cancellation, empty snapshot, disable/enable/URL replacement, overlap preservation and failed source isolation. Verify the guards also reject existing edit/cancel RPC entry points for imported rows.
- [ ] Run integration tests to PASS and review migration diff. Do not apply to Production.

## Task 3: Secure fetch, encryption and normalization

**Interfaces:** `fetchIcal(url: string): Promise<string>`, `parseIcal(text: string): CalendarEvent[]`, `encryptSourceUrl(url: string): Promise<string>`, `decryptSourceUrl(payload: string): Promise<string>`. The serialized encrypted envelope contains key version, nonce and authenticated ciphertext, stored together in `ical_url_encrypted`.

- [ ] Add failing tests for provider hostname/userinfo/port/IP/redirect rejection, oversized streaming responses, deadline, malformed ICS, folded lines, duplicate UID, empty calendar, leap day, exclusive end, cancellation and unsupported recurrence/timed events.
- [ ] Add `ical.js` after verifying its pinned version and dependencies. The user selected this library; document dependency changes and inspect its license/package before installation.
- [ ] Implement provider allowlist from Task 1, native fetch bounds and AES-GCM via Web Crypto with a random nonce and configured versioned key. Test encrypted round-trip, ciphertext tampering and missing-key failure without leaking plaintext.
- [ ] Normalize only required availability fields with `ical.js`; discard summary/description/customer text. Reject conflicting duplicate UIDs in the same snapshot.
- [ ] Run Node tests to PASS and verify bundling/execution on local Workers runtime; browser-oriented JavaScript is not by itself proof of Workers compatibility.

## Task 4: On-demand refresh and source management actions

**Interfaces:** `refreshHouseCalendars(listingId: string): Promise<CalendarSyncSummary>`; summary exposes per-source ID/label/provider/last-success/stale/safe error, never encrypted or plaintext URL. `CalendarSyncSummary` freshness is per source; aggregate stale if any enabled source has no fresh snapshot.

- [ ] Write failing service tests for 300-second TTL, 60-second cooldown, concurrent claims, partial failure, no sources, no successful snapshot and maximum 3 in-flight fetches.
- [ ] Implement repository/service orchestration using Task 2/3 contracts; derive house scope on server and write only under lease ownership.
- [ ] Add source list/add/replace/enable/disable/manual-refresh actions. Validate payloads and repeat role checks per action; test unauthenticated, missing allow_booking, non-admin source mutation and substituted house/source IDs.
- [ ] Connect gallery/per-house reads to refresh currently requested houses before returning current booking rows and sync summaries. Bound total request work; if configured source count makes awaited response budgets insufficient, revise scheduling before shipping.
- [ ] Run service/action tests to PASS; inspect response DTOs and safe errors for secrets.

## Task 5: Calendar, read-only source workspace and reporting isolation

**Interfaces:** Extend Booking/GalleryBookingSlice with nullable `calendar_source_id`; calendar DTO contains display provider/label and sync summary. Source linkage governs editability and report exclusion.

- [ ] Inspect and present reusable UI options; use existing shell, Button/Input/Label/Alert/Dialog or Sheet without introducing another component library.
- [ ] Write regression tests for imported-only read-only events, internal/external overlapping days, multiple-source visibility, unknown freshness/error, internal edit/cancel continuity and counts that do not double-count overlapping nights.
- [ ] Implement per-house source workspace, safe list/forms, provider label, freshness and conflict display. Imported rows never open the editable customer/payment form.
- [ ] Add new reporting migration to exclude `calendar_source_id IS NOT NULL` at the shared base query and detail lookups; inspect other reporting/analytics queries and apply equivalent filters where imported data can affect business results.
- [ ] Test dashboard totals/counts/agency groups and direct detail access with imported confirmed rows alongside internal confirmed/waiting/cancelled rows.
- [ ] Run regression tests to PASS; verify desktop/mobile, keyboard operation and overlapping event behavior in browser.

## Task 6: End-to-end verification and documentation

- [ ] Run controlled synthetic integration flow: add Agoda source, refresh, change date under same UID, remove event, valid empty feed, failed fetch, concurrent refresh and two sources with overlapping dates. Assert stored bookings and displayed freshness after every transition.
- [ ] Test real Agoda sample in a safe environment once URL is available; record counts/date behavior without private content. Distinguish fixture-only verification from live-provider verification.
- [ ] Update README and `.env.example` with server encryption-key configuration, limits, permission model, source lifecycle, imported-report exclusion and troubleshooting.
- [ ] Review security boundaries, migration compatibility, audit volume under repeated identical snapshots and application behavior before completion. Avoid updating unchanged booking rows merely to record a refresh; source timestamps record freshness.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; fix relevant failures and preserve unrelated user changes.
- [ ] Save verification evidence and remaining limitations in `docs/superpowers/reports/<execution-date>-ical-booking-import-verification.md`. Commit focused changes only if requested; deploy only under an explicit deployment request.

## Plan Review and Execution

This plan proposes bounded awaited refresh and admin-only source management for MVP. It requires real database metadata and a safe Agoda sample before dependent implementation can be finalized. Review these assumptions and the source lifecycle semantics before implementation. Inline execution is the default recommendation because schema, sync, calendar and reporting contracts are tightly coupled; delegation remains optional if explicitly requested.
