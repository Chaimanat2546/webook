# MVP 1 Screen Design

MVP 1 is read-only. It displays houses and house images without mutations.

## `/admin/houses`

Purpose: select a house and open its image management page.

This page is not a gallery and must not show images.

### Layout

- Mobile: compact stacked cards, no images
- Tablet: compact card/list hybrid, no images
- Laptop/Desktop: dense admin table, no images

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

## `/admin/houses/[houseId]/images`

Purpose: view images and metadata for one house.

Image previews are allowed on this page because images are the main task.

### Layout Direction

Use a folder-based image management layout.

- Treat `image_zone` as folders
- Show selected zone images only
- Avoid showing every zone as one long stacked landing page
- Mobile uses a sticky zone switcher or compact folder selector
- Desktop uses a two-panel layout when practical

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
