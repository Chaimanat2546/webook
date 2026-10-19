# Business dashboard time windows

Extend the existing business dashboard as explicitly requested: all business cards support a single selected date with hourly booking buckets, a recurring clock window on multiple dates, and full days (00:00–24:00), in Asia/Bangkok. Booking statistics retain their existing updated_at basis; new houses retain created_at. Start is inclusive and end is exclusive. Implicit monthly reports remain daily.

Reuse the existing WebsiteDateRangePicker and its validated whole-hour clock controls for the business header and business list filters. Use independent business timeFrom/timeTo URL parameters; preserve explicit website analytics selections. Apply commits dates and clocks together; cancellation discards drafts. List, detail, sort, paging, and Back links preserve the business clocks.

Extend the existing dashboard_report RPC with optional validated clocks and real hourly buckets in a new migration. Apply clocks to the common authorized booking base, before totals, status counts, agency ranking, and paging. Preserve actor scope, calendar-import exclusion, confirmed-only money, and existing check-in date override; clock filters still refer to updated_at when that override is selected. Only service_role may execute the RPC. Filter new-house timestamps before counts, previews and pagination using the same Bangkok window.

Keep existing card layouts. Add clock context and hourly axis/tooltips where relevant. No dependencies, new business metrics, or permission expansion. Deploy only through the existing staging branch CI/CD, with migrations preceding application deployment and existing bundle target checks.

Verify canonical/invalid hours, midnight and 24:00, all three modes, zero and nonzero counts, denied/owner/admin scope, aggregate reconciliation, link retention, existing tests, build, review, CI success and live Staging behavior.
