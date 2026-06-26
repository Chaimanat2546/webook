# Admin Shell

The admin shell must scale as the app gains more admin pages.

## Desktop And Laptop

- Use a left sidebar navigation
- Keep sidebar width compact
- Highlight the active route
- Keep page content in a main panel
- Put utility icons and user/avatar actions in a small top area if needed

Suggested nav labels:

- Dashboard
- บ้านพัก
- รูปภาพ
- Users
- Logs

Only build routes that are in scope. Extra labels may appear in mockups for layout realism, but they must not imply implemented features.

## Mobile

- Use a top app bar
- Put admin navigation behind a hamburger button
- Open navigation in a `Sheet` or drawer
- Do not use a crowded horizontal menu
- Do not use a bottom nav with many admin items

Mobile top bar should contain:

- app name
- current section or compact page label
- hamburger trigger
- optional avatar or account indicator

## Page Content Rules

- Page controls live in the page content, not in the app navigation
- Search belongs near the page header
- Primary page actions must be explicit text buttons, not icon-only controls
- Mobile content must remain usable with one hand
