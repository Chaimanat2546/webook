# Admin mobile navigation

The admin shell uses a floating rounded dock below the existing `md` breakpoint.
Authorized modules have a fixed priority: Overview, Bookings, Houses,
Advertisements, Quotations, Website users, WeBooks users. Overview receives the
server-computed dashboard permission. The two user modules remain separate.
Server authorization remains authoritative.

With zero or one authorized module, the dock is hidden and content does not
reserve dock clearance. Two modules receive two equal-width cells. Three or more
modules show the first three permitted modules; later modules appear in the
existing hamburger Sidebar/Sheet. Overflow navigation never reorders the dock.
The current dock module uses a full teal cell; opening an overflow module leaves
all dock cells unselected. Dashboard report/detail routes belong to Overview.

Mobile list headers retain a hamburger entry, including pages previously reached
through More. Customers remains a secondary quotation menu in the hamburger. A sole module
receives a root-list link in the hamburger when on one of its secondary pages,
so hiding the dock never removes the path back to its list.
Install and logout follow the menu links. Logout is always available in the
current shell, so even a single-module account keeps its hamburger. Desktop
retains its existing full sidebar and menu order.

Detail/edit/task routes hide the global mobile header and dock so existing local
back/save controls remain available. House task pages retain the House Workspace
Shell. Module access and unsaved-work guards are unchanged.

Root-list query strings, including Overview, are remembered in memory while the
admin shell remains mounted. Both dock and hamburger module links restore the last URL for that
list through one shared in-memory provider. Reloading clears this memory; search values are never written to persistent
browser storage. This does not promise scroll restoration or unsaved form retention.

## Acceptance checks

- All 128 permission-flag combinations preserve priority, return at most three
  dock items, and put only later modules in overflow.
- Zero/one-module cases render no dock; two-module cases render two links.
- Overview/report routes select Overview; user-management modules are distinct.
- Workspace exclusions and list-query memory remain covered by existing tests.
- Dock cells have a 64px minimum height, 20px icons, equal widths and visible
  keyboard focus. Content with a dock reserves 96px plus the safe area.
- Hamburger overflow, quotation customers and logout remain accessible. Desktop
  continues to show its original sidebar and hides the dock.
- `npm run verify` and `npm run build` are required. Local browser fixtures use
  simulated permission flags/routing and are not authenticated device tests.

## Design references

- [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): stable primary destinations.
- [Shopify mobile](https://help.shopify.com/en/manual/shopify-admin/shopify-app): operational list-to-detail workflows.

No new dependencies or deployment are required by this change.

## Mobile task controls audit

Task pages keep local controls instead of adding global navigation. House and
user back links, advertisement create/edit back links, and quotation back
controls use a 48px minimum touch target on mobile. House/user section navigation
and quotation settings navigation also use 48px targets with larger labels.
House Workspace Shell structure stays intact.

- House details, prices and facilities retain their existing submit actions with
  larger mobile buttons. Read-only permissions do not gain a save action.
- Image management keeps immediate upload/delete operations. Cover ordering
  keeps its explicit save/confirmation controls, with larger mobile targets.
- User details and permissions retain their separate save buttons, enlarged on
  mobile. Advertisement cancel/save controls fill the available mobile width.
- Quotation editor keeps its existing guarded back/save/preview bar, enlarged
  on mobile. Settings uses a labeled back link through the existing dirty guard;
  seller/payment/certification save buttons and layout publish are enlarged.
- New quotations without a seller profile now offer both settings and a return
  to the quotation list. Existing-quotation and generic task fallback links are
  also enlarged.

Browser fixture verification measured house back/section links at 48px with 16px
labels at a 360px viewport. These are component checks, not full authenticated
save-flow or native-device tests. No save semantics or unsaved-work guards change.

Task controls use Lucide icons with visible text: back arrow, save, preview eye,
settings gear and layout publish/upload. Decorative icons are hidden from assistive
technology. The mobile quotation command bar stacks icons above labels in 64px
minimum buttons, with bottom content padding including the device safe area.

Use “ยกเลิก” only as the negative choice in a yes/no confirmation modal. Regular
controls name their actual behavior: “กลับไปจัดการรูป” for navigation,
“คืนค่าเดิม” for resetting edits, “เลิกเลือก” for leaving selection mode, and “ปิด”
for closing a customer form. The cover-order review dialog returns with
“กลับไปเลือกรูป”; it is an editing/review dialog rather than a yes/no question.

## Quotation preview

The editor preview starts fitted to both available width and height. The A4
document renderer remains unchanged; a preview-only transform scales its measured
dimensions. ResizeObserver accounts for viewport changes and document content
growth. Plus/minus controls zoom from the fitted size, and Full Page resets zoom
and scroll. Closing/reopening starts fitted again. At 360px, the A4 fixture fits
without scroll overflow; zooming makes the document scrollable. Native pinch
behavior has not been tested on a physical device. No changes affect PDF output.

## Login landing and direct module entry

Successful sign-in continues to `/`. The root page reads the same cached server
permission set as the admin shell and redirects to the first allowed module in
the navigation priority order. It never assumes that a user denied Bookings can
open Houses. With no allowed modules it renders an authenticated no-access view
with a contact-administrator message and logout, rather than redirecting in a loop.

Each of the seven module route layouts checks its module permission and redirects
unauthorized direct URLs to `/`, which chooses the permitted landing destination.
Unauthenticated requests still redirect to login. These layouts add navigation
behavior only: existing page/service/action/API authorization, per-record checks,
owner DV isolation and database policies remain in force. Booking access still
requires the verified UID check; this change retains the existing authorization
rules of all other modules.
