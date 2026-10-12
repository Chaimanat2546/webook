# External calendar content UI

- Scope: user-approved reference layout for the existing house calendar content. House header/sidebar/shell, server authorization, URL protection and data contracts are unchanged.
- Connected rows show provider icon/name, source label, enabled status, Bangkok sync time, controlled Switch and existing dropdown. Refresh wording explicitly identifies all calendars because the existing action refreshes all sources for the house.
- New-source form offers only Airbnb, uses a trimmed house title capped at 120 characters (Airbnb fallback), and keeps the URL masked with new-password autocomplete. Editing retains label input and optional URL replacement; disabled sources stay disabled when edited.
- TDD: workspace/source-row tests failed before the UI change; label normalization regression failed before adding normalization. Focused tests pass 5/5. Independent reviewer identified the long-title bug; fix re-reviewed with no remaining findings.
- Local isolated browser preview renders the real CalendarSources and HouseWorkspaceShell with synthetic source data and fake network actions, not the live database. Desktop 1280px and mobile 360px were observed; mobile document scrollWidth equals viewport width (360). Dropdown edit and cancel were exercised, with original URL never prefilled. Provider selector/input alignment corrected after rendered inspection.
- Browser automation stalled while interacting with the native confirmation dialog for a synthetic source; cancelling/confirming the toggle and subsequent browser actions were not verified. No real booking/source data changed. Full server-action integration and real-device testing were not performed.
- Final `npm run build` and `npm run verify` exit 0: typecheck passed, lint 0 errors/11 existing warnings; 973 tests, 969 passed, 0 failed, 4 skipped. Initial concurrent build/typecheck attempt failed on generated .next files; final verification was repeated after build completed and passed.
- No deployment, commit or push in this change. Screenshot export did not preserve the observed full rendered view, so it is not accepted as visual proof. Browser confirmation blocked cleanup/viewport reset; temporary preview server stopped. Manual confirmation testing remains a follow-up.

## Name input correction

- User confirmed the source name must be editable during creation as well as editing. Removed the create-mode visibility guard from the existing label/input; retained prefilled house title, required validation, 120-character limit, masked URL and action payload.
- SSR regression failed when the name was hidden, then passed after the correction. Reviewer approved the scoped change. Fresh build, typecheck and lint completed (0 errors/11 existing warnings); full suite 973 tests, 969 passed, 0 failed, 4 skipped. No new browser verification or deployment for this small correction.

## Unified form alignment

- User approved one form grid: platform, editable name, masked URL, submit. All fields have visible labels and 44px controls. Container breakpoints use one column on narrow screens, two columns at 24rem content width, four at 42rem. Existing source rows and house shell unchanged.
- Visible-label regression observed failure before implementation, then relevant 5 tests passed. Reviewer approved scoped layout/semantics. Browser detected an 8px Select misalignment caused by spacing around its hidden input; field wrappers now use grid gap instead of sibling margins.
- Isolated in-app browser with real components and synthetic data: at 1280px all four controls top=335px, height=44px; at 600px provider/name top=331px and URL/submit top=409px; at 360px single column, scrollWidth=360px. At 768px content also accommodated the four-column layout without overflow. Viewport reset, tab closed, preview server stopped. No real source saves or production operations.
- Final sequential build and verify exit 0: typecheck passed; lint 0 errors/11 existing warnings; 973 tests, 969 passed, 0 failed, 4 skipped. Screenshots `.superpowers/calendar-grid-desktop.png` and `calendar-grid-mobile.png` show synthetic preview, not Staging. No deploy/commit/push. Full live action integration and real-device testing remain unverified.

## Copy, blank name and global source refresh

- Removed the two user-specified explanatory paragraphs. Create/reset name is empty with placeholder “เช่น Airbnb บัญชีหลัก”; edit still loads the existing name. Removed the unused title default helper/prop and its obsolete test.
- One visible “อัปเดตทั้งหมด” button sits beside the connected-source heading, disabled when busy or no sources. It reuses the existing house-scoped refresh action; per-source dropdown now contains edit only. Existing edit URL warning retained.
- TDD observed 2 failures, then 4 relevant tests passed. Reviewer approved code and identified stale documentation; guide updated. Sequential build/verify exit 0: typecheck passed, lint 0 errors/11 existing warnings; 972 tests, 968 passed, 0 failed, 4 skipped.
- Isolated browser verified 1280px layout, placeholder/empty name, refresh success with fake action, edit name preservation and cancel reset. At 360px document width is 360 and name remains empty. Screenshot `.superpowers/calendar-copy-desktop.png` uses synthetic data. Viewport reset/tab closed/server stopped. No real data changes, deployment, commit or push.

## Direct edit action

- Replaced the connected-source row's single-action dropdown with the existing outline Button and Pencil icon labelled “แก้ไข”, beside Switch. Edit state, masked URL, busy guard and house-list menus are unchanged.
- Regression failed before implementation and then 4 relevant tests passed. Independent scoped review found no actionable issues. Sequential build and verify exit 0: typecheck passed; 972 tests, 968 passed, 0 failed, 4 skipped.
- Isolated browser with synthetic data verified the direct button opens the existing edit form with the source name, blank URL, and cancel resets to the empty create form. Desktop 1280px and mobile 360px inspected; mobile scrollWidth equals 360px. Screenshots `.superpowers/calendar-edit-desktop.png` and `calendar-edit-mobile.png` are local preview only, not Staging. No real source data changes, deployment, commit or push.
