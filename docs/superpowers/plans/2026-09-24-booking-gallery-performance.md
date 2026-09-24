# Booking Gallery Performance — Approved Execution

User approved implementation after explicitly removing baseline measurement. Previous broad plan is superseded by this bounded execution plan.

## Requirements

- Server-side title/DV search and six-house pagination with total count and stable ordering. Do not fetch every house to paginate locally.
- Availability reads only for visible houses: one to six validated property IDs, one month range. Server resolves listing IDs and preserves exact listing/property pair scope.
- Batched minimal booking projection: id, listing_id, houseid, check_in, check_out, status. No customer join, prices, notes or details. Paginate DB rows until exhausted, preserve null/unknown noncancelled statuses as occupied, exclusive checkout and 42-day spillovers.
- Changing one card month loads only that house. Client cache per house/month, bounded to 24 pairs with 30-second freshness. Prevent late responses after search/page/month changes or mutation invalidation; error/loading never claims availability.
- Save/cancel invalidates all cached/inflight months for that house and reloads only currently visible affected entries. Other houses do not refetch because of that mutation.
- Lazy-load existing editor using next/dynamic when selected, accessible loading state, preserving focus, CSS, dirty-close, validation and original Sheet route.
- Existing visuals/controls unchanged: six/page, Thai independent months, title/DV only, per-card create, three desktop/one mobile columns. Use existing Input/Button/Pagination components. This cross-house booking module is not House Workspace Shell.
- No dependencies, schema/RLS changes, production operations, deploy, merge or push in this execution. Preserve requireBookingAdmin on every new action.

## Task 1: Coherent bounded data-flow migration

Tasks 2 and 3 of the draft are combined because action contracts and the client consumer must migrate together. Introduce GalleryHouseSummary, GalleryHousePage, GalleryPageInput, GalleryCalendarInput and GalleryBookingSlice in lib/booking-gallery.ts (or a focused adjacent module); actions listBookingGalleryHousesAction and listBookingGalleryCalendarsAction accept unknown validated input. Metadata and availability must remain separate.

- [ ] Read Next local client/server and lazy-loading guides; read TDD skill and writing-good-tests before code.
- [ ] Add failing behavior tests for six-house pagination, title/raw DV/prefixed DV search, invalid/duplicate/oversize IDs and pages, no unnecessary queries, strict scope, dense row pagination, null unknown statuses.
- [ ] Implement repository and service methods. Escape/filter PostgREST operators. Stable title/property ordering; if exact Thai locale ordering conflicts with DB collation, report rather than fetching all houses.
- [ ] Add failing race/cache tests with framework-light helpers. Implement client page/search debounce250ms, per-pair cache and grouped reads, targeted invalidation and lazy editor. Refactor into focused modules if needed; do not build a generic data framework.
- [ ] Update tests and docs; run focused tests during iteration. Self-review, full verify/build with harmless placeholder public Supabase environment, commit and write report.
- [ ] Independent task review; fix Critical/Important findings.

## Task 2: Integration verification

- [ ] Root independently verifies bounded query behavior and browser fixture with real client components/synthetic actions; no hosted database writes.
- [ ] Full build/typecheck/lint/tests and whole-branch review. No prior latency measurements required and no quantitative speedup claim.
- [ ] Present completed result and integration choice; deploy requires separate authorization.

## Review focus

Rapid changes and in-flight mutations; cross-month stays; wrong listing/property pairs; database row caps; search pagination boundaries. Cover each in behavioral tests, not source regex alone. Retain existing legacy route tests.

## Implementation notes

- Gallery metadata and availability now use separate authorized actions. The former queries six ordered listing rows plus an exact count; the latter resolves one to six validated property IDs and reads only their listing/property booking pairs with minimal fields and 500-row pagination.
- Client search waits 250 ms; each visible card/month pair has an independent 30-second, 24-entry cache. Mutation invalidates all months for one house and reloads its visible month. The existing booking editor loads on selection.
- Database title/property ordering is deterministic but may differ from JavaScript Thai locale collation. Exact raw and DV-prefixed property-ID search is supported; partial numeric ID search is outside this bounded query design.
