# House Image Back-to-Basic Flow Design

Date: 2026-06-29

## Context

The current house image manager uses a staged-change model: admins add draft uploads or mark images as deleted, then commit everything with a single save button.

The new direction is a simpler operation-based flow:

- Uploads happen immediately after file selection.
- Single-image deletion happens only after a confirmation dialog with image preview.
- Bulk deletion uses an explicit selection mode and a confirmation dialog.
- There is no global save/cancel bar for the house image screen.

This remains scoped to admin-only house image management. It does not add public listing pages, booking, payment, SEO, or full house data CRUD.

## Decisions

- Select all applies only to the current image zone.
- Upload allows selecting multiple files and uploads them immediately as one batch.
- Upload is all-or-nothing. If any file or storage/database step fails, no new image rows should remain and uploaded objects should be cleaned up.
- Delete remains limited to Cloudflare R2-managed images.
- Legacy AWS/S3 images stay display-only and must not be selectable or deletable.
- Bulk selection starts only after the admin clicks a select-mode control.
- Bulk delete is best-effort per image. Rows that delete successfully are removed. Rows whose database delete fails remain visible after refresh. R2 storage cleanup failures are reported as warnings because the UI record may already be removed.
- Feedback uses toast notifications and refreshes the grid automatically.

## UI Flow

The zone header keeps the current zone identity, image count, and upload action.

Default mode:

- Show an upload button.
- Show a select button.
- Show a single delete button only on R2 images.
- Do not show delete controls on AWS/S3 legacy images.
- Clicking a valid image card still opens the read-only preview.

Upload flow:

1. Admin clicks upload.
2. Admin selects one or more files.
3. The selected files upload immediately into the current zone.
4. While upload is pending, disable upload controls and show a pending state.
5. On success, show a success toast and refresh the route.
6. On failure, show an error toast and keep the current grid state.

Single delete flow:

1. Admin clicks the delete icon on one R2 image.
2. Open a confirmation dialog with the image preview, filename, and destructive confirmation button.
3. If confirmed, call the single delete action.
4. On success, show a success toast, close the dialog, and refresh the route.
5. On failure, keep the dialog/grid state truthful and show an error toast.

Bulk select flow:

1. Admin clicks select.
2. Checkboxes appear only on deletable R2 images in the current zone.
3. The header changes to selection controls: select all, clear selection, delete selected, and exit selection mode.
4. Select all selects only deletable R2 images in the current zone.
5. The admin can untick individual images.
6. Delete selected opens a confirmation dialog with the selected count and a compact list or thumbnails.
7. On confirmation, call the bulk delete action.
8. On full success, show a success toast and refresh.
9. On partial success, show a partial-result toast and refresh so database-delete failures remain visible.
10. If a row was removed but R2 cleanup failed, show a warning toast that storage cleanup did not fully complete.

## Server/Data Flow

Use operation-specific server actions instead of one staged update action.

### `uploadHouseImagesAction(propertyId, formData)`

Inputs:

- `image_zone`
- `images`

Behavior:

- Require admin authentication and accommodation permission.
- Validate that the house exists.
- Validate property id, zone, and every selected file before upload.
- Upload all files to R2 using the existing house image storage adapter.
- Insert image rows after successful upload.
- Preserve the existing `image_move` behavior: new order is scoped to the selected `property_id + image_zone`.
- Revalidate `/admin/houses` and the current house image page.
- Return a success shape that includes uploaded count.

Failure behavior:

- If validation fails, do not upload anything.
- If upload partially succeeds and then fails, clean up already uploaded objects.
- If database insert fails after uploads, clean up uploaded objects.
- Do not expose secrets, credentials, authorization headers, or full provider responses to the client.

### `deleteHouseImageAction(propertyId, imageId)`

Behavior:

- Require admin authentication and accommodation permission.
- Load the image from trusted server-side data.
- Confirm the image belongs to the requested property.
- Confirm the image provider supports delete.
- Delete the database row first, then attempt physical R2 object deletion, matching the current implementation bias toward avoiding dangling UI records when database delete fails.
- If the database row is removed but R2 cleanup fails, return a warning result. The image is removed from the grid after refresh, but the admin is told that storage cleanup did not fully complete.
- Revalidate `/admin/houses` and the current house image page.

### `deleteHouseImagesAction(propertyId, imageIds)`

Behavior:

- Require admin authentication and accommodation permission.
- Load images from trusted server-side data.
- Only operate on ids that belong to the requested property and are R2 deletable.
- Attempt deletion per image and return a structured result:
  - deleted image ids
  - database-delete failed image ids or filenames
  - storage-cleanup failed image ids or filenames
  - skipped image ids when they are missing, not part of the property, or not deletable
- Revalidate `/admin/houses` and the current house image page.

Failure behavior:

- Bulk delete is best-effort per image.
- Images with database-delete failures remain after refresh.
- Images with database rows removed but failed R2 cleanup do not remain in the grid, but they are reported as storage cleanup warnings.
- The client displays a partial-result toast when at least one image fails or is skipped.

## Error Handling

Upload:

- Unsupported type or oversized file blocks the whole batch.
- Storage failure blocks the whole batch and cleans up uploaded objects.
- Database insert failure blocks the whole batch and cleans up uploaded objects.

Single delete:

- Non-R2 images are blocked server-side even if the client UI is bypassed.
- Images from another property are blocked server-side.
- Errors show a toast without exposing private details.
- If database deletion succeeds but R2 cleanup fails, show a warning toast and refresh the grid.

Bulk delete:

- Non-R2, missing, or wrong-property images are skipped or returned as failures.
- Database-delete failures stay visible after refresh.
- Storage-cleanup failures are reported as warnings because the image row may already be gone.
- The result toast distinguishes full success from partial success.

## Testing

Update or add tests for:

- Operation-specific action exports:
  - `uploadHouseImagesAction`
  - `deleteHouseImageAction`
  - `deleteHouseImagesAction`
- Upload all-or-nothing behavior and cleanup intent.
- Provider policy: AWS/S3 images remain display-only and not deletable.
- UI no longer contains the staged save/draft flow for house images:
  - no global save button
  - no draft preview state
  - no `SaveIcon`
  - no dirty-state save/cancel bar
- UI contains:
  - upload-immediately behavior
  - select mode
  - select all scoped to the current zone
  - single delete confirmation with preview
  - bulk delete confirmation
- Existing zone navigation, compact grid sizing, preview dialog, and return URL behavior remain intact.

Before finishing implementation, run the allowed verification commands:

- `npm run typecheck`
- `npm run lint`
- `npm run test`

## Documentation Updates

Update existing project docs when implementing:

- `docs/image-management.md`
- `docs/image-management/mvp-4-add-delete-image-records.md`
- `docs/image-management/mvp-5-external-provider-file-crud.md`

The docs should state that house image management is now operation-based, upload happens immediately, delete requires confirmation, bulk select is current-zone scoped, and AWS/S3 legacy images remain display-only.

## Open Questions

None. The selected design is ready for implementation planning after user review.
