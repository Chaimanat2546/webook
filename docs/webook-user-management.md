# WeBooks User Management

`/admin/users` manages users stored in WeBooks's own `public.users` table. It is
independent from `/admin/user-manager`, which manages users in external tenant
systems.

Access is restricted to an authenticated local user with `allow_tools.allow_members === true`.
That check controls the sidebar entry and is repeated by both the page and its
Server Action.

The list shows name, username, email, and Role. It supports server-side search
across name, username, and email, pagination of eight users per page, and a
responsive loading skeleton. Name, Role, DV ID and supported tool permissions are editable
through the dedicated edit workspace. Role options are loaded from `public.roles`; the
server checks that the selected Role still exists before updating. Username,
email, telephone, password, Ban state, and Supabase Auth data are never changed
by this feature.

The mutation path uses a server-only service-role client after authorization.
The browser receives no credentials or privileged client, and the repository
sends only the editable fields through `webook_update_user_guarded`, with the verified Auth actor.
The RPC checks current actor/target roles under row locks. Non-root membership managers cannot
appoint role 1 or change an existing root account, including its permissions. Client-origin writes
to `public.users` are denied, including through legacy SECURITY DEFINER mutation paths.
Migration `20261026160000_webook_user_role_guard.sql` must be applied before this update path.

See [Login history](./login-history.md) for the separate, stricter permission to read other users'
login/location history. `allow_members` by itself does not grant that access.
