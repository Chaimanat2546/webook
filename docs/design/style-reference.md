# Style Reference

## Source References

- Linear.app: https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/linear.app
- Airtable: https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/airtable
- Supabase: https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/supabase

## VillaAdmin Style Translation

VillaAdmin translates those references into a light, practical admin UI for pool villa image management.

Use Linear for:

- restrained SaaS polish
- compact spacing
- subtle borders
- focused primary actions
- calm visual hierarchy

Use Airtable for:

- dense data tables
- searchable lists
- multi-column scanning
- compact metadata
- admin data workflows

Use Supabase for:

- technical admin mood
- calm error and empty states
- security-conscious product tone
- developer-tool confidence

## Do

- Use neutral light backgrounds and white or near-white surfaces
- Use subtle zinc/slate borders
- Use a restrained blue accent for primary actions and focus
- Keep page headers compact
- Keep data dense but readable
- Use monospace for IDs and technical fields
- Prefer table/list layouts for admin indexes
- Use image previews only where images are the actual task

## Do Not

- Do not copy any source brand directly
- Do not use Linear's dark marketing canvas as the app default
- Do not create landing pages
- Do not use decorative gradients or large hero sections
- Do not make `/admin/houses` look like a public villa listing
- Do not show gallery thumbnails on `/admin/houses`
- Do not use oversized cards for admin lists

## Page Mapping

### `/admin/houses`

Reference mix:

- Linear for shell, spacing, and polish
- Airtable for search, table/list density, and scanability
- Supabase for calm technical admin mood

UI direction:

- no images
- mobile compact cards
- desktop dense table
- search near the top
- one action: `จัดการรูป`

### `/admin/houses/[houseId]/images`

Reference mix:

- Linear for file-manager layout polish
- Airtable for structured metadata
- Supabase for technical image/admin management mood

UI direction:

- image previews are allowed here
- zone-as-folder navigation
- selected zone images only
- global `image_move` values stay visible
- no long landing-style stacked sections by default
