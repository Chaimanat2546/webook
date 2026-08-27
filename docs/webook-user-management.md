# Webook User Management

`/admin/users` manages users stored in Webook's own `public.users` table. It is
independent from `/admin/user-manager`, which manages users in external tenant
systems.

Access is restricted to an authenticated local user with `role_id === 1`.
That check controls the sidebar entry and is repeated by both the page and its
Server Action.

The list shows name, username, email, and Role. Only `name` and `role_id` are
editable in this release. Role options are loaded from `public.roles`; the
server checks that the selected Role still exists before updating. Username,
email, telephone, password, Ban state, and Supabase Auth data are never changed
by this feature.

The mutation path uses a server-only service-role client after authorization.
The browser receives no credentials or privileged client, and the repository
sends exactly `name` and `role_id` in its update payload. No migration is
required for this scope.
