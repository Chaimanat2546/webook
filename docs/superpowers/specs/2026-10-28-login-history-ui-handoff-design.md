# Login, optional location and History UI implementation design

Date: 2026-10-28 (Asia/Bangkok)

Status: approved by the user in the current chat on 2026-10-28; implementation follows this design.

## Sources and precedence

- User decisions in the current chat on 2026-10-28 override conflicting earlier designs.
- Visual and interaction reference: `C:/Users/chaym/Documents/Codex/ux-ui-designer/projects/webooks-website-mobile-redesign/implementation-handoff-flow01-flow02.md`.
- Native visual source: `C:/Users/chaym/.pencil/documents/1f6f9a35-0433-4afd-bd18-fd7762839430/webook.pen`.
- Token source: `C:/Users/chaym/Documents/Codex/ux-ui-designer/projects/_standards/WEBOOKS-STANDARD.md`.
- Existing implementation: `docs/login-history.md` and the login-history repository, API and migrations. Earlier self-history access and visible location-result/retry flows are superseded.

## Intent and scope

Implement UI01 normal/submitting/invalid, UI02 optional location, and all six UI04 states from the handoff. Reuse UI03's existing `/` landing logic without redesigning Home. Only users with a unique `public.users.uid` mapping whose `role_id = 1` may view History, including their own records. All successfully signed-in users continue to create audit events and may optionally submit location evidence for their own current session.

House Workspace Shell does not apply: these are authentication and account-audit screens, not a workspace for one house. Reuse the shared admin shell for History and the existing authentication card primitives for Login/location.

Do not add tables, columns or location statuses. Do not change retention cleanup, add a queue, add tracking, install dependencies, redesign unrelated modules or deploy as part of implementation. Remove the 90-day disclosure from the in-scope product UI; keep operational retention documentation accurate.

## Approaches

1. **Recommended implementation call:** compose existing Button, Input, Field, Card, Alert, Skeleton, Badge, ThaiDateRangePicker, Pagination primitives, Sheet, Popover and RadioGroup. Adapt shared header behavior only where these flows need it. Extend the existing listing RPC and tighten existing RLS through a new migration. This keeps access enforcement and filtering accurate across the complete result set.
2. Filtering/sorting the fetched page in the browser is rejected: totals, oldest-first order and later pages would be incorrect.
3. A new UI library or duplicate custom primitives is rejected: existing components already cover the required interactions and the project prohibits unapproved dependencies.

The user supplied the filter, permission and persistence behavior. Component composition, query parameter names and the background transport below are engineering proposals, not additional user decisions.

## Design roles and layout

Apply Royal/Azure roles to the in-scope screens without recoloring unrelated existing screens or the original logo. Prefer a scoped theme wrapper so root tokens do not change every module. A shared header may accept an explicit in-scope style variant. Preserve dark-mode readability using a deliberately checked scoped treatment; the supplied reference defines the light design, not an invented new site-wide dark palette.

| Role | Value |
| --- | --- |
| Canvas / surface | `#F7F8FC` / `#FFFFFF` |
| Subtle, selected, skeleton | `#EEF1F8` |
| Border | `#DDE2EC` |
| Primary action | `#2F3EE8` |
| Visible focus | `#5B8CFF` |
| Main / secondary / disabled text | `#20283A` / `#647087` / `#8A99A3` |
| Text on filled primary | `#FFFFFF` |

Use the existing original transparent logo. Preserve semantic error/warning colors. Use Plus Jakarta Sans for Latin content with the existing Noto Sans Thai font as Thai fallback; source a local approved font asset during implementation if available, without adding an npm dependency. Keep changes scoped to UI01/UI02/UI04.

Mobile baselines are 390px and 360px, 16px side insets, 8px functional-control geometry, readable Thai and safe-area spacing. Desktop remains supported. UI01/UI02 have no authenticated navigation chrome. UI02 has an authenticated server session despite using the authentication visual shell. UI04 uses the shared 62px mobile branded header with hamburger, original logo, WeBooks, ภาพรวมธุรกิจ, current Bangkok date and existing borderless notification bell. Do not duplicate header or notification logic.

## UI01: Login

Keep the current password-recovery route and original logo. Use labelled identifier/password inputs, `autocomplete=username` and `autocomplete=current-password`. Add a labelled show/hide password button that preserves the value. Required inputs and Enter submit work normally.

Keep card/form geometry and input values across idle, submitting and invalid states. During submission disable inputs, visibility toggle and submit; announce the compact progress indicator and `กำลังเข้าสู่ระบบ`. On invalid credentials show `อีเมลหรือรหัสผ่านไม่ถูกต้อง` with semantic error text/icon/borders and accessible field associations. Preserve the identifier and restore useful focus. Separate bounded server/transport errors from invalid credentials, keep them inline, and never echo credentials or raw infrastructure errors. Never place a password in URLs, logs or persistent browser storage.

Successful sign-in retains the existing bounded server-side audit creation. A saved event leads to UI02 for that session; an audit-creation failure retains the existing best-effort continuation to `/` without inventing an event. No sign-in retry or duplicate event is introduced.

## UI02: Optional location and background persistence

Exact visible copy:

- Title: `ก่อนเริ่มใช้งาน`
- Question: `อนุญาตให้บันทึกตำแหน่งของการเข้าสู่ระบบครั้งนี้หรือไม่`
- Reason: `ใช้เป็นหลักฐานในประวัติความปลอดภัยของบัญชี`
- Actions: `อนุญาต` and secondary text action `ข้าม`

No visible save progress, result, error, retry, technical troubleshooting link or 90-day disclosure. Do not show a location toast/banner on Home. Remove the Staging probe from end-user Login/location links and remove its end-user route; do not retain an iPhone support screen in this journey.

### Dispatch and lifecycle

- `ข้าม`: mark the event handled for this tab, dispatch the existing JSON location API request with `skipped`, and immediately `router.replace('/')` without awaiting the save result.
- `อนุญาต`: start browser geolocation from the user gesture. Keep the continuation card stable while permission/location is unresolved, prevent duplicate actions and provide a nonvisual waiting status. Preserve existing bounded read/watchdog behavior and rejection of stale fixes. Once classified, dispatch its existing report and continue to `/` without waiting for persistence.
- Background dispatch uses same-origin `fetch` with `keepalive: true`, `credentials: 'same-origin'`, JSON, `cache: 'no-store'`, a small bounded body and a bounded network deadline. No service worker queue, persistent coordinates or automatic retry is added. The API remains `POST /api/login-history/location`.
- Once a report is dispatched, component unmount must not abort that request. Geolocation callbacks still cancel when leaving before classification or when account/session context changes. Detached completion must not update an unmounted component or emit user feedback. Server checks continue to bind the history ID to the currently verified user/session and original time window.
- A request that is lost, rejected or fails does not manufacture a location outcome. An unfinalized row stays `pending`; History displays `ไม่ได้รับข้อมูลพิกัด`. Successful reports preserve existing terminal-status immutability.
- A reload of a previously attempted event does not request location again: continue to `/`; if no result was received, leave `pending`. The existing per-tab marker stores only an event marker, never coordinates. Remove any UI path that leaves the user blocked on that marker.
- Neither skip nor background completion requires the user to know the save outcome. Immediate continuation does not promise guaranteed delivery after the browser closes; `pending` is the accepted fallback.

## History authorization

Derive History permission from an exact Auth-user-to-`public.users.uid` match with `role_id = 1`. Do not use email fallback, `allow_members`, seller membership, a client flag or a role supplied in query parameters.

- Hide every History navigation/shortcut for non-root users, including the no-module-access screen. Keep History outside the default module landing/dock order.
- Verify permission again on direct `/admin/login-history` access, before fetching records. An authenticated non-root user receives concise forbidden content with `กลับหน้าหลัก` and no audit rows or counts. The shared admin header may remain.
- A new migration replaces the existing SELECT policy so non-root users cannot directly read even their own table rows. The service-role listing RPC independently rejects non-root actors even with empty search criteria.
- Location recording/current-event lookup/attachment continue to work for any signed-in owner of that current session. Do not apply the History viewing restriction to the location collection API.
- Keep the existing role-assignment safeguards, ownership/session checks, no-store responses and private-data cache exclusions.
- Expired sessions return to UI01 with `เซสชันหมดอายุ โปรดเข้าสู่ระบบอีกครั้ง`; distinguish this from first-time unauthenticated access and explicit logout where feasible. No credential-error copy for session expiry.

## UI04 query model

Continue to use the existing server page/service/repository pipeline and URL-based criteria. Engineering proposal: `q`, `from`, `to`, `status`, `sort`, `page`, `pageSize`. Default page size stays 25, maximum 100. Search remains literal matching over current profile name/username/email; UI placeholder is `ค้นหาชื่อหรืออีเมล`.

| Status label | Existing stored value |
| --- | --- |
| ทั้งหมด | No status predicate |
| ได้รับพิกัด | `success` |
| ไม่ได้รับข้อมูลพิกัด | `pending` |
| ผู้ใช้ข้าม | `skipped` |
| ไม่อนุญาต | `denied` |
| อ่านพิกัดไม่ได้ | `unavailable` |
| หมดเวลา | `timeout` |
| อุปกรณ์ไม่รองรับ | `unsupported` |

Sort is `ล่าสุดก่อน` (default, descending time then UUID) or `เก่าสุดก่อน` (ascending time then UUID). The UUID tie-breaker makes pagination deterministic. Both the predicate and order apply to the complete authorized dataset before LIMIT/OFFSET; count and results use the same predicate.

`ตัวกรอง` opens an existing Sheet on mobile and a compact existing Popover on desktop. Use single-select groups for location status and time order, with clear section labels and an apply action. Engineering call: edit draft values inside the surface, apply both together, reset to page 1, and discard uncommitted draft on dismiss. Search/date changes also reset page 1. Keep selected filter values visible in compact summaries and retain the existing separate Thai date range picker.

Extend `HistoryFilter` validation, service/repository contracts and the existing listing RPC with allowlisted status/sort inputs. Use a new migration; never edit existing migrations. Replace or safely wrap the old RPC signature so it cannot retain non-root self access. This modifies query functions and policy only, not table shape, columns or status values. Validate both server input and RPC input; invalid non-date criteria get a concise inline filter error, not a date error or an unrestricted query.

Dates remain inclusive Bangkok calendar dates with the existing half-open UTC bounds. Date errors use `ช่วงวันที่ไม่ถูกต้อง กรุณาเลือกใหม่`. A reversed, malformed or impossible date must not issue the listing query.

## UI04 states

Keep shared header, title, query controls and criteria mounted/available across state changes. Remove numeric retention disclosure from the header and any in-scope UI copy.

| State / reference | Required behavior |
| --- | --- |
| Loading `YqRrg` | 3–4 stable journal-shaped skeletons, nonvisual status, preserved controls/criteria |
| Records `Ozi79` | Group the current page by Bangkok login day; scan time/device/browser/OS, identity/IP and location status with icon + text + semantic treatment. Show actual stored accuracy, never fixed example accuracy. Keep an appropriate desktop presentation. |
| Default empty `gDxMi` | History icon and `ยังไม่มีประวัติการเข้าสู่ระบบ`; no onboarding CTA |
| Filtered empty `zNLtA` | `ไม่พบรายการที่ตรงกับตัวกรอง`, criteria retained, one outlined `ล้างตัวกรอง` action |
| Invalid date `CaDwM` | Exact inline date error, error associations and focus on the date control/group; correction remains possible on the same screen. Keep last successful records visible when available, and never show stale rows as newly matched data. A direct invalid URL has the same shell/controls without fabricated records. |
| Load failure `YfrPL` | `โหลดประวัติไม่สำเร็จ` content plate and outlined `ลองใหม่`, preserving current criteria |

A non-default sort alone does not count as a narrowing criterion for filtered-empty copy. Active search, dates or a specific location status do. `ล้างตัวกรอง` resets search/date/status, sort to latest-first and page to 1, never deleting history. Retry requests the same criteria. Page changes retain all criteria. Prevent older responses overwriting newer criteria.

Use one white rounded outlined pagination container with previous, centered page label and next. Disabled controls remain named and non-actionable. The optional helper is computed from existing page/pageSize/total and actual entry count, e.g. `แสดง 1–25 จาก 80 รายการ`; do not add backend fields. For zero results avoid a misleading range. Clamp or recover out-of-range pages consistently without calling a positive-total page gap “no history”.

## Architecture / implementation touch points

- `app/login/page.tsx`, `app/login/actions.ts` and focused auth form components: persistent form state, typed action result, pending/error behavior and expiry copy.
- `components/auth/login-location-request.ts`, `components/auth/login-location-prompt.tsx`, `app/login/location/page.tsx`: explicit attempt, classified background dispatch and continuation.
- Shared admin navigation permission contracts, `server/auth/admin-navigation.ts`, sidebar/no-access links: root-only visibility, reusing exact-UID authority.
- `server/auth/login-history.ts`, `lib/login-history.ts`, `server/services/login-history.ts`, `server/repositories/login-history.ts`: root viewing gate, validation and query contracts. Keep collection authentication distinct from viewing authorization.
- New `supabase/migrations/` file: root-only SELECT policy and root-only filtered/sorted listing RPC. No retention-function change.
- `app/admin/login-history/`, focused history components and shared header style variant: reusable shell, journal, bounded states, sheet filters and pagination.
- Scoped styles/fonts and original logo reuse. Read the installed Next.js guides before code changes as required by AGENTS.md.
- Update `docs/login-history.md` for the new viewing policy, best-effort background behavior, query criteria and removal of end-user retention copy. Historical verification reports remain historical evidence.

## Validation and delivery

Use behavioral tests for root/non-root direct and RPC/table access; non-root owners still attaching their own reports; all status predicates and both sort directions across pages/ties; Bangkok dates and malformed date criteria; criteria-preserving retry/pagination/clear; immediate skip while persistence remains unresolved; unmount after dispatch; lost saves remaining pending; deny/unavailable/timeout/unsupported continuation; attempt-marker reload; account/session changes; and credential values/pending/error focus behavior.

Run relevant existing tests, database policy/RPC tests where a safe local fixture is available, TypeScript, lint and the production build with a safe local environment. No secret values in outputs. Inspect actual browser states against the named native frames at 390px and 360px, plus desktop, keyboard use and 200% zoom/reflow. Record visual/accessibility/runtime verification and limits separately. Do not call a static-source review runtime verification.

Review the implementation before completion. No remote migration or deployment is authorized by this design. If deployment is later requested, follow AGENTS.md environment checks and Staging-only commands unless Production is explicitly requested and separately confirmed.
