# Admin page width

All routes under `app/admin` use `AdminPageContainer` through
`AdminMobileContent`. Content is centered at a maximum of `80rem`
(`max-w-7xl`), matching Dashboard. The outer shell retains its existing
16px mobile / 24px desktop padding and mobile navigation clearance.
Do not add another horizontal padding layer to individual pages.

## Section rollout — 2026-10-14

- House list: header, search, table/cards and pagination share the frame.
- Advertisements: list and create/edit forms inherit the same frame.
- Users: WeBooks lists/details and central user manager inherit it.
- Quotations: list, customers, editor and company settings inherit it.
  Document previews retain their paper dimensions; printing uses its own portal.
- House workspaces: details, images and calendar sources retain the existing
  House Workspace Shell, 16rem sidebar and content-owned scrolling.
- Bookings: calendar gallery inherits the frame; responsive column counts,
  editor dialogs and calendar interactions remain owned by their components.
- Dashboard, loading, empty and error states receive the same outer frame.

The shared wrapper has no height, overflow, position or padding rules.
Wide tables continue to scroll inside the existing Table component.
Print removes the maximum width. Public routes are outside AdminShell.

## Verification

- TypeScript and 156 relevant existing layout, mobile navigation, house,
  advertisement, user, quotation/print and booking UI tests passed.
- Independent code review found no actionable wrapper regression.
- Browser fixture using the real container, Table and HouseWorkspaceShell:
  320, 390, 768, 1280 and 1920px viewports had no document horizontal overflow;
  wide tables retained internal horizontal scrolling. At 1920px the content
  stayed 1280px with the simulated sidebar expanded and collapsed.
- This fixture verifies shared layout primitives; it does not replace an
  authenticated walkthrough with live data for every admin route.
