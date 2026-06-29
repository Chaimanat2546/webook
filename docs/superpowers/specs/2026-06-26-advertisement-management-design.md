# Advertisement Management Design

## Goal

Build an admin-only advertisement media manager in `webook`.
The app stores advertisement metadata in Supabase, stores files in Cloudflare R2 through a Worker, and exposes only active advertisement metadata to other systems through the Supabase API.

`webook` does not provide a public/customer advertisement page.

## Approved Decisions

- Use `title` as the advertisement name field.
- Store image references as `image_name` keys, not full URLs.
- Other systems read `image_name` from Supabase and build the Cloudflare Worker URL themselves.
- Each advertisement must have 1-2 images.
- Admin list shows all advertisements, sorted active first.
- Public Supabase API shows only `is_active = true`.
- Add image uploads stay in draft until the user clicks save.
- Existing image deletion is immediate after confirmation.
- Users cannot manually order images; the system normalizes order to `1, 2`.
- Preview is available for existing R2 images and newly selected draft images.
- Use shared media storage:
  - R2 bucket: `webook-media`
  - Worker name: `webook-media`
  - Start domain: `*.workers.dev`
  - Advertisement image prefix: `advertisements/`

## Schema

```sql
create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advertisement_images (
  id uuid primary key default gen_random_uuid(),
  advertisement_id uuid not null references public.advertisements(id) on delete cascade,
  image_name text not null,
  image_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisement_images_order_unique unique (advertisement_id, image_order),
  constraint advertisement_images_order_range check (image_order between 1 and 2)
);
```

The minimum-one-image rule is enforced in admin services because a simple row check cannot count child rows safely.

## RLS

- Enable RLS on both tables.
- Public read for `advertisements`: `is_active = true`.
- Public read for `advertisement_images`: parent advertisement is active.
- Admin write only for create, update, and delete.
- No public insert, update, or delete.

Public read example:

```text
advertisements?select=id,title,advertisement_images(image_name,image_order)&is_active=eq.true
```

## Image Keys

Images live in the shared `webook-media` R2 bucket and are served through the shared `webook-media` Worker.

Use deterministic R2 keys:

```text
advertisements/{advertisement_id}/1.webp
advertisements/{advertisement_id}/2.webp
```

Display URL shape:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_name}
```

Worker route behavior:

- `GET /{image_name}` is public read.
- `PUT /{image_name}` requires Bearer secret.
- `DELETE /{image_name}` requires Bearer secret.

Create a new R2 image URL/key helper instead of reusing `lib/aws-image-url.ts`, because the existing AWS helper intentionally rejects `/` in image names.

## Admin Flow

`/admin/advertisements`

- List all advertisements.
- Sort by `is_active desc`, then `updated_at desc`.
- Show title, active status, image count, and updated time.
- Link each row to detail.
- Provide create action.

`/admin/advertisements/new`

- Enter title.
- Select 1-2 images.
- Preview selected local draft images.
- Do not upload until save.
- Leaving the page discards the draft.
- Save validates title and image count before uploading.

`/admin/advertisements/[id]`

- Edit title.
- Toggle active status.
- View existing images.
- Preview existing images through the Worker URL.
- Add images as draft until save.
- Delete existing images immediately after confirmation.
- Block deletion if it would leave zero images.

## Save And Delete Behavior

Create:

1. Validate non-empty `title`.
2. Validate 1-2 image files.
3. Generate advertisement id.
4. Upload files to R2 through the Worker/storage adapter.
5. Insert `advertisements`.
6. Insert `advertisement_images`.
7. If Supabase write fails, best-effort delete newly uploaded R2 objects.

Update:

1. Validate non-empty `title`.
2. Validate final image count is 1-2.
3. Upload newly added draft images on save.
4. Update advertisement metadata.
5. Insert new image rows.
6. Normalize `image_order` to `1, 2`.

Delete image:

1. Confirm with the user.
2. Check the image is not the last image.
3. Delete the R2 object.
4. Delete the `advertisement_images` row.
5. Normalize remaining `image_order`.

If R2 delete fails, do not delete the database row.
If database delete fails after R2 delete succeeds, show an error and leave the row for retry/reconciliation.

## Validation And Security

- Admin pages must call `requireAdmin()`.
- Client components must not access R2 credentials or Supabase service role keys.
- Validate `image_name`:
  - must stay under the `advertisements/` prefix
  - no `..`
  - no protocol or host
  - allowed image extensions only
- Validate uploaded file type and size server-side before sending to R2.
- Do not expose full image URLs through Supabase in MVP.
- Do not create an open image proxy.

## Testing

Minimum tests:

- public query returns only active advertisements
- public image query returns only images whose parent advertisement is active
- admin list sorts active advertisements first
- create requires title and at least one image
- create rejects more than two images
- delete rejects deleting the last image
- image order normalizes to `1, 2`
- R2 image helper rejects path traversal and non-image extensions

## Non-goals

- Public advertisement page in `webook`
- Manual image ordering
- More than two images
- Rich text, description, CTA link, schedule, targeting, analytics
- Background reconciliation job for orphaned R2 objects
- Database trigger for minimum child image count
