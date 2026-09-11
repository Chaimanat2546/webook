# Admin mobile navigation

The admin shell uses bottom tabs below the existing `md` breakpoint: Houses,
Advertisements, Quotations, Users and More. Destinations follow the existing
`allow_tools` permissions; server authorization remains authoritative. Houses
appears for accommodation, price or cost access; Advertisements requires
accommodation access; Quotations requires quotation access; Users requires
membership access. Hidden destinations do not reserve space.

Users opens the existing Dropdown Menu upward, with independently authorized links
to website users and WeBooks users. Customers and quotation settings are reached
from the existing quotation list toolbar. More reuses the existing mobile
Sidebar/Sheet for install and logout. Desktop retains the existing sidebar.

Detail/edit/task routes hide the global mobile header and tabs so existing local
back/save controls remain available without overlapping controls. House task
pages retain the House Workspace Shell. Error/not-found screens include a link
back to their module list. A quotation without a seller profile provides links to
settings and the quotation list.

Root-list query strings are remembered in memory while the admin shell remains
mounted, regardless of which link initiates navigation. Switching tabs restores
the last URL for that list. Reloading clears this memory; search values are not
written to persistent browser storage. This does not promise scroll restoration
or preservation of unsaved form input.

## Acceptance checks

- Permission tests cover missing house/quotation access and distinct active tabs.
- Route tests cover list roots and task routes; memory tests cover query retention,
  ignored detail paths, stable snapshots and fresh-session reset.
- Local component fixture at 360px and 390px: no horizontal overflow; bottom
  targets have a 72px minimum height, 24px icons and 13px labels. Wrapped labels
  can increase the height; content reserves 96px plus the safe area. Query values
  survive switching categories.
- Users opens the permitted user-management links; More contains install/logout.
  Closing More restores focus to its
  opener. At 1280px, desktop sidebar is visible and bottom tabs are hidden.
- Task fixture hides global controls. Real quotation dirty-form confirmation and
  installed Edge/iOS/Android flows still require authenticated device testing.
- `npm run build` and `npm run verify` are required for changes. The browser fixture
  uses real navigation components with simulated routing and no backend calls;
  it is not an authenticated end-to-end test.

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
