# MVP 1 Screen Design

MVP 1 is read-only. It displays houses and house images without mutations.

## `/admin/houses`

Purpose: select a house and open its image management page.

This page is not a gallery and must not show images.

Design status: mobile and desktop directions are approved from Stitch references. Implementation must rewrite the design with shadcn/ui primitives and Tailwind classes rather than copying generated HTML.

### Layout

- Mobile: compact stacked cards, no images
- Tablet: compact card/list hybrid, no images
- Laptop/Desktop: dense admin table, no images

Approved mobile direction:

- Top app bar with VillaAdmin label, current section, hamburger menu, and compact account/notification affordance
- Compact page header and search input
- Stacked house cards with title, `property_id`, status badge, details, and full-width `จัดการรูป`
- Loading, empty, empty search, error, and unauthorized states share the same compact mobile shell

Approved desktop direction:

- Left sidebar admin shell
- Compact page header with search input
- Dense table with visible `จัดการรูป` action in every row
- Inactive rows are muted but still readable and clickable
- Pagination can appear as a visual placeholder but is not required for MVP 1 implementation unless the data API supports it

### Data

Show:

- `title`
- `property_id`
- `bedrooms`
- `bathrooms`
- `location_zone`
- `is_active`
- `จัดการรูป`

`id` may exist internally but does not need to be visible.

### Search

Search input placeholder:

`ค้นหาบ้านพัก...`

Search fields:

- `title`
- `property_id`
- `location_zone`

Search results still sort active houses before inactive houses.

### Sorting

Show all houses.

1. `is_active = true`
2. `is_active = false`

Inactive houses remain visible but less prominent.

### Actions

The only per-house action is:

`จัดการรูป`

Do not include add, edit, delete, upload, import, booking, pricing, SEO, or save controls.

### States

- Loading: skeleton cards on mobile, skeleton rows on desktop
- Empty: `ยังไม่มีข้อมูลบ้านพัก`
- Empty search: `ไม่พบบ้านพักที่ค้นหา`
- Error: `โหลดรายการบ้านพักไม่สำเร็จ`
- Unauthorized: `คุณไม่มีสิทธิ์เข้าถึงหน้านี้`

### Implementation Notes

- Use shadcn/ui `Sheet`, `Input`, `Card`, `Table`, `Badge`, `Button`, `Skeleton`, and `Alert`
- Use Tailwind classes only; do not add custom CSS files for this screen
- Do not copy Stitch CDN scripts, Tailwind runtime config, inline scripts, or generated HTML directly
- Do not depend on Material Symbols from Stitch; use existing project icons or text-only controls
- Keep inactive house actions visible and clickable unless product requirements change

## `/admin/houses/[houseId]/images`

Purpose: view images and metadata for one house.

Image previews are allowed on this page because images are the main task.

Design status: mobile normal and desktop directions are approved from Stitch references. Implementation must rewrite the design with shadcn/ui primitives and Tailwind classes rather than copying generated HTML.

### Layout Direction

Use a folder-based image management layout.

- Treat `image_zone` as folders
- Show selected zone images only
- Avoid showing every zone as one long stacked landing page
- Mobile uses a sticky zone switcher or compact folder selector
- Desktop uses a two-panel layout when practical

Approved mobile direction:

- Top app bar with VillaAdmin label, current section, hamburger menu, and compact account affordance
- Back link, house title, `property_id`, total image count, and read-only badge stay near the top
- Horizontal zone chips act as folder navigation and keep the selected zone obvious
- Show only the selected zone images
- Image cards stack vertically with preview, global order badge, zone badge, `image_name`, `created_at`, and `updated_at`

Approved desktop direction:

- Reuse the admin sidebar shell
- Header shows back link, house title, `property_id`, total image count, and read-only badge
- Left panel lists zone folders with global order ranges and image counts
- Right panel shows the selected zone header, image count, global order range, and image card grid
- Image order badges show actual global `image_move` values

### Data

Show:

- house title
- `property_id`
- image preview
- `image_name`
- `image_zone`
- `image_move`
- `created_at`
- `updated_at`

### Ordering

- Group images by `image_zone`
- Sort zone folders by the lowest `image_move` in each zone
- Sort images inside each zone by `image_move`
- Display actual global `image_move` values
- Do not reset order numbers per zone
- Approved zone example: `cover` #1, `living_room` #2-#4, `bedroom` #5-#6, `pool` #7-#8, unassigned #9

Missing or empty `image_zone` goes under:

`ไม่ระบุหมวด`

### Read-only Controls

Show a small read-only badge:

`ดูอย่างเดียว`

Do not include upload, import, delete, edit, save, reorder, drag handle, set cover, checkbox selection, or bulk actions.

### States

- Loading: skeleton header, zone navigation, and image cards
- Empty house images: `บ้านนี้ยังไม่มีรูป`
- Empty selected zone: `หมวดนี้ยังไม่มีรูป`
- Error: `โหลดรูปภาพไม่สำเร็จ`
- Unauthorized: `คุณไม่มีสิทธิ์เข้าถึงหน้านี้`
- House not found: `ไม่พบข้อมูลบ้านพัก`
- Image failed: `แสดงรูปไม่ได้`

### Implementation Notes

- Use shadcn/ui `Sheet`, `Button`, `Badge`, `Card`, `ScrollArea`, `Skeleton`, `Alert`, and `AspectRatio` if it already exists in the project
- Use Tailwind classes only; do not add custom CSS files for this screen
- Do not copy Stitch CDN scripts, Tailwind runtime config, inline scripts, or generated HTML directly
- Do not depend on Material Symbols from Stitch; use existing project icons or text-only controls
- Do not add mutation controls until MVP scope changes
