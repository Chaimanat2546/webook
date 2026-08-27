# Webook User Management

## Goal

Add a Webook-local user management area. It is separate from the existing
Central User Manager, which manages approved users in external tenants.

Only a user whose `public.users.role_id` is `1` may see or use this feature.
All other roles must not see its menu entry and must be rejected by its route
and every server-side mutation.

## Scope

The feature manages records in Webook's `public.users` table and their linked
Supabase Auth accounts:

- List Webook users in a responsive table/card layout.
- Edit `name`, `username`, `tel`, and `email`.
- Ban a user and prevent that person from continuing or starting a session.
- Unban a user and restore their ability to authenticate.

Creating users and changing roles are out of scope.

## Access control

Add a dedicated `canManageWebookUsers` permission predicate and a corresponding
server-side guard. Both use the existing role rule: `role_id === 1`.

The admin sidebar renders a new `จัดการผู้ใช้ Webook` entry only when the
predicate permits it. The new `/admin/users` page runs the guard before it
loads any user data. Every Server Action runs the same guard; hiding the menu
is never treated as authorization.

The Central User Manager remains at `/admin/user-manager` unchanged.

## Data model and Auth lifecycle

Create a new migration that adds a durable ban status to `public.users`. The
migration also adds the least-privilege RLS policies and indexes needed for
Role 1 administrators to read and mutate this feature's data. Existing
migrations remain unchanged.

The `uid` field links a Webook user record to Supabase Auth. A server-only
service using the existing service-role client is responsible for Auth Admin
API operations; no privileged client or secret reaches a client component.

Ban must:

1. Mark the `public.users` record as banned.
2. Set a long Supabase Auth ban duration on the linked account, blocking a new
   sign-in immediately.
3. Make `requireAdmin` reject a current session whose linked local user is
   banned, so every subsequent Webook server request loses access immediately.

Unban removes the Auth ban duration and marks the local record active again.
Supabase Auth's temporary ban does not revoke an already issued stateless JWT;
the local check closes that Webook access window on the next request. The
implementation must coordinate failure paths so it does not claim success when
database and Auth states differ; it should apply a compensating update where an
operation fails after an earlier change.

Administrators cannot ban their own account.

Changing an email validates uniqueness and updates both `public.users.email`
and the linked Supabase Auth email through the same server-side orchestration.
If either update cannot be completed, the service returns a safe error and
restores the prior state where possible.

## UI

`/admin/users` shows a responsive user list:

- Desktop table columns: name, username, email, telephone, status, and an
  action column aligned right.
- Mobile cards show the same information while keeping actions reachable.
- The row action menu uses icons and contains Edit plus exactly one lifecycle
  control: active users show Ban; banned users show Unban. They are never
  shown together.
- Edit opens a dialog for `name`, `username`, `tel`, and `email`.
- Ban and Unban each open a confirmation dialog, then refresh the affected
  list after success.
- Status and failure messages are accessible and do not expose implementation
  details or secrets.

## Architecture

The implementation follows the existing boundaries:

```text
app/admin/users/ (route and Server Actions)
  -> server/services/webook-users.ts (authorization-aware orchestration)
  -> server/repositories/webook-users.ts (public.users queries only)
  -> Supabase database and Auth Admin API
```

Reusable visual pieces belong below `components/admin/user-management/` and
reuse the existing table, dialog, dropdown, badge, button, card, and Lucide
icon primitives.

## Validation and error handling

Server-side input validation trims text and validates record IDs, email format,
username constraints, phone values, and email/username uniqueness. The browser
receives only safe, user-facing errors. Authorization and validation happen
before any repository or Auth Admin operation.

## Verification

Tests cover:

- Role 1 menu visibility, route authorization, and action authorization.
- Listing and responsive presentation.
- Edit validation, uniqueness, and database/Auth email synchronization.
- The mutually exclusive Ban/Unban actions and their icons.
- Ban blocking at sign-in and on the next authenticated Webook request, unban
  behavior, failed-operation compensation, and the self-ban guard.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before
the feature is declared complete. Update behavior documentation with the
implemented feature.
