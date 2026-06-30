# Webook Design

Design guidelines for the admin-only pool villa image management app.

## Documents

- [Global Design System](DESIGN.md)
- [Style Reference](style-reference.md)
- [Admin Shell](admin-shell.md)
- [MVP 1 Screens](mvp-1.md)

## Design Direction

Webook is a light, compact admin interface inspired by Linear, Airtable, and Supabase.

- Linear: calm SaaS polish, restrained hierarchy, compact controls
- Airtable: dense tables, list scanning, multi-column data readability
- Supabase: technical admin mood, calm security/error states

This is not a marketing site, public villa listing, booking flow, or image gallery.

## Implementation Rules

- Mobile-first across mobile, tablet, laptop, and desktop
- Tailwind and shadcn/ui friendly
- Small radius, usually 6px-8px
- Subtle borders over heavy shadows
- Compact page headers, no hero sections
- Thai UI labels with technical field names kept readable
- Status labels must not rely on color only
- Avoid custom complex widgets unless the approved flow needs them

## Core Components

Prefer shadcn/ui primitives:

- `Button`
- `Input`
- `Card`
- `Table`
- `Badge`
- `Alert`
- `Skeleton`
- `Sheet`
- `Tabs` or compact chips only where navigation benefits
- `AspectRatio` for image previews

## Product Scope

MVP 1 is read-only.

Do not design create, edit, delete, upload, import, reorder, save, booking, pricing, SEO, or customer-facing controls unless a later MVP explicitly adds them.
