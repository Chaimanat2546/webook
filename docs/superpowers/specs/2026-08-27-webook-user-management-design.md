# Webook User Management

## Goal

Add a Webook-local user management area at `/admin/users`. It is separate from
the Central User Manager at `/admin/user-manager`, which manages approved users
in external tenant systems.

Only users whose `public.users.role_id` is exactly `1` may see the menu, open
the route, or submit its Server Action. Hiding the menu is not authorization;
the route and mutation each enforce the same server-side guard.

## Scope

The page lists records from Webook's `public.users` table. It may display the
user's name, username, email, and current Role, but this release edits only:

- `public.users.name`
- `public.users.role_id`

Role options come from every current row in `public.roles`; they are not coded
into the browser. Creating users, deleting users, Ban/Unban, editing email,
editing username, editing telephone, and Supabase Auth synchronization are out
of scope. This feature needs no schema migration.

## UI

The desktop layout uses the existing shadcn table primitives and keeps an
Action column on the right. Mobile uses cards with the same read-only identity
and Role information. Each row or card exposes one icon-labelled `แก้ไข`
action. The dedicated edit page contains a name input and a Role select populated from
`public.roles`. The list supports server-side search across name, username, and
email, paginates eight users per page, and shows a responsive skeleton while its
server-loaded list is pending.

## Architecture and security

```text
app/admin/users/ (Role 1 route and Server Action)
  -> server/services/webook-users.ts (validation and use case)
  -> server/repositories/webook-users.ts (users/roles queries)
  -> server-only Supabase service-role client
```

The Role 1 guard runs before the service creates the privileged client. Client
components receive only serializable user/Role data and never receive a key or
Supabase client. Shared presentation DTOs live in `lib/webook-users.ts` so the
UI does not depend on the repository layer. The update repository allowlists
exactly `name` and `role_id`.
The service validates UUID, trimmed name length, a positive smallint Role ID,
and confirms the selected Role still exists before writing.

## Verification

Tests cover the strict Role 1 predicate and menu wiring, guard ordering,
service validation, loading Role options, the exact update allowlist, the
responsive presentation, search, pagination, skeleton loading, and the name/Role-only edit page. Type check, lint, the
full test suite, and production build must pass before completion.
