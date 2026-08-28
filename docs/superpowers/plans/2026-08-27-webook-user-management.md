# Webook User Management Implementation Plan

**Goal:** Add a Role 1-only Webook user manager which lists local users and
edits only their name and Role.

**Spec:** `docs/superpowers/specs/2026-08-27-webook-user-management-design.md`

## Constraints

- Keep `/admin/user-manager` unchanged as the Central User Manager.
- Show `/admin/users` only when `public.users.role_id === 1`.
- Guard both the route and Server Action on the server.
- Load Role choices from `public.roles`.
- Update only `public.users.name` and `public.users.role_id`.
- Do not add Ban/Unban, Auth synchronization, lifecycle locks, or migrations.
- Reuse existing shadcn UI primitives and do not add dependencies.

## Implementation

- [x] Add `canManageWebookUsers` and `requireWebookUserManagerAdmin`.
- [x] Pass the dedicated permission through the admin layout and add a separate
  `จัดการผู้ใช้ Webook` menu entry.
- [x] Add a server-only repository for listing `users`, listing `roles`,
  checking Role existence, and updating the two allowlisted columns.
- [x] Add a validation service for UUID, trimmed name, and smallint Role ID.
- [x] Add `/admin/users` and one narrow update Server Action.
- [x] Add a responsive table/card list and a name/Role edit dialog.
- [x] Add focused tests for authorization, boundaries, service behavior, and UI.
- [x] Update maintainer documentation.
- [x] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- [x] Review the final diff and commit the feature.
