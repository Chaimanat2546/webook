# House Route Permissions Design

## Goal

Use existing `users.allow_tools` values to control access to house-management
routes and actions in the Next.js admin app. Do not add any permission keys,
database migrations, or database-policy changes.

## Access model

| Admin capability | Required allow tool | Allowed behavior |
| --- | --- | --- |
| Open the house list | Any of `allow_accommodation`, `allow_price`, or `allow_cost` | View `/admin/houses` and only the house actions the user may open |
| Edit house details | `allow_accommodation` | View and save the details section; rating remains restricted to `role_id = 1` |
| Edit facilities | `allow_accommodation` | View and save the facilities section |
| Manage house images and cover order | `allow_accommodation` | View, upload, delete, move, and select cover images |
| Manage base prices | `allow_price` | View and save Deville and Agency prices |
| View Agency prices | `allow_cost` without `allow_price` | Open the prices section, see Agency prices only, with no submit control |

When both `allow_price` and `allow_cost` are present, `allow_price` wins and
the user has full price-management access.

## Route and navigation behavior

`/admin/houses` requires at least one house capability. Its per-house action
menu shows only links the current user can open:

- Details and facilities for `allow_accommodation`.
- Prices for `allow_price` or `allow_cost`.
- Images and cover ordering for `allow_accommodation`.

Direct routes apply the same checks:

- `/admin/houses/[propertyId]` defaults to details and requires
  `allow_accommodation`.
- `?section=facilities` requires `allow_accommodation`.
- `?section=prices` requires `allow_price` or `allow_cost`.
- `/admin/houses/[propertyId]/images` and cover-select mode require
  `allow_accommodation`.

Disallowed routes return the existing not-found response. Section navigation
shows only sections the current user can open. Existing `returnTo` behavior is
preserved for every allowed link.

## Server-action behavior

Every house mutation checks its capability before loading or changing data:

- Details and facilities actions require `allow_accommodation`.
- Price saves require `allow_price`; `allow_cost` never permits a price write.
- Every image and cover-order action requires `allow_accommodation`.

The price renderer receives an explicit access level. The Agency-only level
does not render Deville fields or a save button, so it cannot submit hidden
price values through the normal UI.

## Authorization boundary

Authorization is centralized in `server/auth/admin.ts` with focused helpers
for house-list access, accommodation management, full price management, and
Agency-price viewing. Pages, menus, and actions consume those helpers rather
than reimplementing JSON checks.

No RLS or other database policy changes are part of this design. Legacy
systems retain their current database access. Therefore these permissions
protect Next.js routes and Server Actions only, not independent direct
database clients that existing policies permit.

## Tests and verification

Tests will cover each helper's allowed and denied cases, list-menu visibility,
direct-route guards, server-action guards, and the Agency-only price display.
Verification will run targeted tests, the full test suite, typecheck, lint,
and production build. No deployment or database migration is included.
