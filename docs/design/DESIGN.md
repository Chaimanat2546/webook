# VillaAdmin Global Design System

VillaAdmin is an admin-only web application for managing pool villa data and pool villa images.

This file is the global design source of truth for current and future admin screens.

## Product Type

VillaAdmin is:

- internal admin software
- data-management focused
- image-management focused
- operational
- mobile-first
- built for repeated admin use

VillaAdmin is not:

- a public villa listing website
- a booking website
- a marketing landing page
- a luxury travel showcase
- a customer-facing gallery
- an ecommerce experience

## Style Sources

Use these references as inspiration only. Do not copy any brand directly.

- Linear.app: calm SaaS polish, disciplined spacing, restrained hierarchy, subtle borders, focused actions
- Airtable: dense tables, list scanning, multi-column readability, searchable records, structured metadata
- Supabase: technical admin mood, developer-tool confidence, calm security/error states, practical dashboard surfaces

VillaAdmin translates those references into a light, practical admin interface.

## Visual Foundation

Use a light admin interface.

- Background: neutral light gray
- Surfaces: white or near-white
- Borders: subtle zinc/slate
- Text: dark neutral
- Muted text: gray/slate
- Accent: restrained blue
- Success: calm green
- Warning: muted amber
- Destructive: restrained red

Keep color functional. Do not use multiple bright accents.

## Shape And Density

Use:

- 6px-8px radius for most UI
- subtle borders
- compact spacing
- predictable alignment
- dense but readable tables/lists
- minimal shadows or no shadows

Avoid:

- oversized rounded cards
- floating decorative sections
- pill-shaped buttons everywhere
- marketing spacing
- large empty whitespace in admin workflows

## Typography

Use admin dashboard typography.

- Compact page titles
- Readable table/card text
- Small but legible metadata
- Monospace styling for IDs and technical fields
- Thai labels must remain readable
- No negative letter spacing
- No hero-scale type inside admin screens

Technical fields can remain visible as:

- `property_id`
- `image_name`
- `image_zone`
- `image_move`

## Layout System

Design mobile-first.

Support:

- mobile
- tablet
- laptop
- desktop

Global admin shell:

- Desktop/laptop: left sidebar navigation
- Tablet: collapsible sidebar or compact rail
- Mobile: top app bar with hamburger menu
- Mobile navigation opens in a sheet/drawer
- Do not use crowded horizontal navigation on mobile
- Do not use bottom nav with many admin sections

Page layout:

- compact page header
- optional subtitle
- toolbar/search area
- main content area
- practical loading, empty, error, unauthorized states

## Component System

Design so implementation stays close to Tailwind CSS and shadcn/ui.

Prefer:

- `Button`
- `Input`
- `Card`
- `Table`
- `Badge`
- `Alert`
- `Skeleton`
- `Sheet`
- `Separator`
- `Tabs`
- `ScrollArea`
- `AspectRatio` for image preview screens only

Avoid:

- custom complex widgets
- unusual dependencies
- decorative components that are hard to rebuild
- icon-only actions when text labels are clearer

## Interaction Rules

- Primary actions must be clear text buttons
- Status must not rely on color only
- Mobile controls must be touch-friendly
- Search should be simple and prominent where record lists can grow
- Do not add advanced filters unless explicitly required
- Do not add speculative controls

## State Patterns

Use consistent styles for:

- loading
- empty
- empty search
- error
- unauthorized
- not found
- image failed to load

States should be calm and practical. Avoid alarming treatment unless there is data loss or security risk.

## Security And Scope Tone

The UI should feel security-conscious.

- Do not expose credentials, tokens, private storage details, or internal auth data in UI examples
- Do not show controls for unsupported features
- If a feature is out of scope, do not show its button

## Current Product Focus

Current MVP focus:

- admin authentication
- protected admin access
- house list for image management
- read-only image display
- image metadata display
- external image URL safety later

Out of scope for current MVP:

- public villa listing pages
- booking
- pricing
- SEO
- payments
- full house CRUD
- upload/import/delete/reorder/save until later MVPs

## Do

- Keep screens compact and scannable
- Use shadcn/ui-friendly primitives
- Keep mobile layouts genuinely usable
- Use table/list patterns for data selection
- Use image previews only where image inspection is the task
- Prefer boring, maintainable admin patterns

## Do Not

- Do not create marketing-style screens
- Do not make `/admin/houses` look like a villa gallery
- Do not use large hero sections
- Do not use decorative gradients
- Do not invent future controls
- Do not copy Linear, Airtable, or Supabase directly
