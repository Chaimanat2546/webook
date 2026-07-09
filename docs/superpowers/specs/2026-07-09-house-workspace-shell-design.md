# House Workspace Shell Design

Date: 2026-07-09

## Goal

Standardize the admin house management workspace so future house-related pages use the same page structure and visual rhythm.

The house detail page is the source of truth for the shell style because it is the calmer, form-heavy management view. Image management pages should align to that shell instead of defining their own frame.

## Scope

In scope:

- House detail page shell.
- House image management page shell.
- House cover selection page shell.
- Shared header, workspace frame, sidebar header, nav item style, and content header pattern.

Out of scope:

- Reworking form field behavior.
- Reworking image upload, delete, or cover selection business logic.
- Creating a generic shell for unrelated admin modules.
- Changing database, RLS, or API contracts.

## Standard Shell Parts

### Shell Header

The top page header contains only:

- Back link.
- House title.
- DV property badge.
- Current task subtitle, such as "Manage house details", "Manage images", or "Sort display images".

The house detail header should no longer carry the image management button. Navigation between tasks belongs in the task flow, not as a permanent header action.

### Workspace Shell

Use the house detail workspace as the standard:

- Rounded border frame.
- Sidebar width based on the house detail page, currently `16rem`.
- Sidebar on the left for desktop.
- Horizontal sidebar nav on mobile.
- Content area owns its own scroll.

The image pages should adopt this frame style so the pages look like siblings.

### Sidebar Header

Desktop sidebar header remains visible.

Labels:

- House detail page: "หมวดข้อมูล"
- Image pages: "ทำเล"

Mobile keeps the header compact and can hide this label when it duplicates the selected item.

### Sidebar Nav Item

Nav items share the same visual pattern:

- Icon.
- Label.
- Optional badge slot.
- Active state.
- Mobile horizontal scroll with the active item scrolled into the first visible position.

The data behind nav items remains separate. House detail sections and image zones should not be merged into one data model.

### Content Header

The content header should use one visual pattern:

- Icon block.
- Current section or zone title.
- Optional badge or subtext.
- Actions aligned to the right.

On mobile, hide duplicate title and badge text when the selected item is already visible in the horizontal nav. Keep required actions compact and reachable.

For the house detail page, the rating control moves here as an action styled like the existing toolbar controls.

For image pages, existing actions stay here:

- Sort display images.
- Select delete.
- Upload images.
- Cancel, sort, and save on cover selection mode.

### Content Body

Keep bodies separate by purpose:

- House detail forms.
- Weekly price form.
- Facility form.
- Image grid and upload failure cards.
- Cover selection grid and confirmation dialog.

Only the surrounding frame and spacing should be standardized.

## Component Direction

Create only small shared components:

- `HouseTaskHeader`
- `HouseWorkspaceShell`
- `HouseWorkspaceNavItem` if it reduces repeated classes without hiding logic.

Do not create one large component that knows about ratings, image uploads, prices, facilities, and cover selection.

Existing page-specific components should keep their own behavior:

- `HouseDetailSectionNav`
- `ImageZoneViewer`
- `CoverSelectViewer`

## Recommended Approach

Use a small shared shell with slots:

- Header slot for title metadata.
- Sidebar header slot.
- Sidebar nav slot.
- Content header slot.
- Content action slot.
- Content body children.

This keeps the visual system consistent while avoiding a props-heavy component.

## Risks

- Moving rating from the shell header into the content header must preserve the current form submission behavior.
- Mobile spacing must be checked because content header actions can wrap.
- Tests that assert exact class names will need targeted updates.

## Verification

Implementation should update or add UI tests for:

- Shared shell classes.
- House detail rating rendered in the content header.
- Image pages using "ทำเล" for the sidebar header.
- Content header icon, title, and badge/subtext pattern.
- Mobile active nav item scroll behavior.

Before completion, run:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
