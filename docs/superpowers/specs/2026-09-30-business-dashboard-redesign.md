# Business dashboard redesign

Status: approved visual direction; implementation and release verification in progress.

## Purpose and reference

Help the business owner understand the selected month's booking volume, current booking statuses, agency sales contribution, and growth of the house inventory. Admin is a business owner with the whole-business scope; a house owner has the same reporting purpose within their own DV scope.

Approved prototype: `C:/Users/chaym/.codex/visualizations/2026/09/30/01a0f09e-9c52-75e0-9492-0c3243f810ae/dashboard-business-redesign.html`.

The prototype's figures and names are examples. Production uses authorized database records. This document defines behavior beyond the prototype's local navigation.

## Overview screen

- Keep the existing admin application navigation. Dashboard does not use the House Workspace Shell because it is a business overview rather than a workspace for managing one house.
- Header: “ภาพรวมธุรกิจ”, visible scope, one month picker. Default month is the current month in Asia/Bangkok. The month applies to every section and detail view.
- Compact context: “ตามวันที่สร้างรายการ · สถานะปัจจุบัน”. Calculation information lives in a small disclosure.
- One summary surface: sales on the left; status distribution on the right. Mobile stacks sales above a two-column status grid. Avoid equal-height empty cards, duplicated actions and decorative icons.
- Sales: “ยอดขายจากการจอง”, total, confirmed booking count, and link to the confirmed list.
- Status distribution: total count and counts for confirmed, waiting, cancelled and repair. Show an additional unknown-status entry when its count is nonzero. Each entry opens the corresponding booking list.
- Admin agency section: top three agencies by sales, direct name and amount labels, confirmed count and percentage of total sales, a share bar, remaining agency count, and “ดูทั้งหมด”. Clicking an agency opens its detail view.
- Admin new-house section: monthly total, the three most recently created houses, name, DV and creation date, and “ดูประวัติทั้งหมด”. Clicking a house opens its detail view.
- Booking section: the three most recently created authorized bookings across all statuses, with house, stay dates, status and amount. Clicking a row opens its detail view. “ดูรายการทั้งหมด” opens the complete list.
- Owner overview omits agency sales and new-house history. It shows the owner's sales, status counts and latest bookings.

The three preview rows provide context and entry points. They do not promise that an entire page fits every screen. Full lists are separate dashboard views with bounded pagination.

## Lists and details

All views use `/admin/dashboard` with an allowlisted `view` query. They replace the overview content rather than adding a long expanded list underneath it.

| View | Visible information and interaction |
| --- | --- |
| `bookings` | Search by house name, numeric/formatted DV or booking code; status filter; optional admin agency filter; house/stay, status, amount; row opens booking detail |
| `agencies` | Admin only; name search; descending sales; amount, count and share; row opens agency detail |
| `houses` | Admin only; house/DV search; newest first; title, DV, creation date; row opens house detail |
| `booking` | Booking code, title, DV, current status, check-in/out, nights, price and creation time; admin may also see agency name |
| `agency` | Admin only; name, confirmed sales/count/share; highest-selling four houses and total contributing house count; link to every confirmed booking for this agency |
| `house` | Admin only; title, DV and creation timestamp; link to the existing authorized house-management route when DV exists |

List page size: 10. A list reports its visible range and filtered total, with previous/next controls. Pagination occurs after scope, month and list filters. Changing search/status resets the affected list to page one. An out-of-range positive page clamps to the last page.

Back controls preserve the month, list filters and page using an internally built dashboard URL. Browser Back retains normal history/scroll behavior. The explicit back link restores recorded source scroll/focus when entered from that source view; a direct deep link returns to the safe source URL without requiring a previous history entry. No arbitrary return URL is accepted.

The displayed booking amount is its full booking price even when the status is waiting or cancelled; it is not added to sales unless confirmed. Repair rows show “—” for amount, while their detail may explain the closure period. Missing booking prices show “ไม่ระบุยอด”. Nights derive from date-only check-in/out values without local timezone subtraction.

Unknown or out-of-scope selected items get the same unavailable/not-found response. Empty lists distinguish an empty month from a filter with no results. Failed reads never show a partial total. Missing confirmed prices retain the existing actionable notice.

## Reporting rules and authorization

- Booking count includes all statuses, including repair and unknown legacy values. Status counts partition the authorized month and sum to the total.
- Sales and agency sales include only `confirmed` and sum `price_max` once per stay using integer satang. Preserve missing-price counts. Shares use the full monthly sales denominator, even while a list is filtered; show “—” for share when the denominator is zero.
- Booking month uses creation time with Bangkok inclusive start and exclusive next-month start. Current status means historical totals can change later.
- New houses use listing creation time, including inactive existing rows. This is not a deletion audit.
- Sort bookings by creation time descending with a stable ID tie-break; new houses by creation time descending and ID; agencies by amount descending, count descending and Thai name.
- Resolve scope from the signed-in UID. Admin role 1 sees all houses. Owners require valid `dv_id`; both booking house and joined listing DV must match it, and the listing ID must match the join.
- Owner payloads contain no agency fields, agency totals, house history or foreign-house records. Owner requests for admin-only views fail closed. Authorization is enforced before detail lookup, not merely by hiding UI.
- Details are selected from the same authorized monthly source used for the report. URL role, DV or IDs never expand access.
- No customer contact data or internal notes are added to dashboard reads.

## Components and boundaries

Use existing Card, Badge, Button, Input, Alert, Pagination and Skeleton components, with Lucide icons. Recommend ordinary dashboard subviews with Back navigation as in the approved prototype. Existing Sheet/Dialog are available but do not match the approved full detail-view flow. No new library is required; the directly labelled share bars need no additional chart library.

Route -> server service -> existing repository -> Supabase. Add framework-light query/navigation and calculations to `lib/`. Keep fetching, scoping and aggregation on the server. Client components are limited to return-navigation/scroll restoration where needed; do not send all monthly bookings to the browser for filtering.

Split the current large dashboard view into overview, summary, preview sections, lists, row components and details. Use the same row components for previews and lists. Do not replace the shared admin shell or change house-management permissions.

No schema migration or data seeding is required. Existing dirty work includes earlier dashboard, dependency, demo and PWA changes; preserve it and record the baseline before execution. Do not broadly clean up unrelated files or remove an existing dependency simply because the new layout does not need it.

## Responsive and validation acceptance

- Validate at 320, 390, 768, 1024 and 1440 CSS pixels, light/dark themes, long Thai names, large values, zero values, missing prices and 100+ rows.
- No main horizontal overflow. Mobile row layout keeps the status and amount visible; names wrap. Detail grids stack at narrow widths.
- Keyboard access, visible focus, labelled controls, real links, accessible status text and touch targets around 44px. Meaning is not conveyed by color alone.
- Verify monthly totals remain unchanged through filtering and agency drilldown, and that owner direct URLs cannot expose admin data.
- Run typecheck, lint, relevant tests, full test suite and build. Build regenerates PWA before the final full test run; do not run build/PWA reproducibility tests concurrently.
- Update `docs/dashboard.md`, review the final diff, then verify the Staging deployment through the UI when deployment is requested for execution.

## Deployment and execution boundary

The present task creates this design and the implementation plan only. No product code or deployment is part of the planning turn.

Execution method: Native, preserving the earlier user choice. Stage the implementation task by task and obtain review before release. Staging uses `npm run deploy:cf:staging`, Supabase `https://sxvkhzhqtrpxgzumsswl.supabase.co`, Cloudflare account `0df55f166fa309dcc904e992c43f86db`. Validate these targets and bundle references without printing secrets. Production deployment requires the separate explicit authorization prescribed by AGENTS.md.
