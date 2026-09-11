# Admin mobile navigation

The admin shell uses bottom tabs below the existing `md` breakpoint: Houses,
Quotations, Customers and More. Destinations follow the existing permissions;
server authorization remains authoritative. More reuses the existing mobile
Sidebar/Sheet for advertisements, user management, quotation settings, install
and logout. Desktop retains the existing sidebar.

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
  targets are 64px high; query values survive switching categories.
- More opens existing permitted secondary links; closing restores focus to its
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
