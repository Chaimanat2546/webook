# Webook User Management

## Access and route

Webook User Management is available at `/admin/users`. It is restricted to an
authenticated, unbanned Webook administrator whose role meets the strict
application requirement `role_id === 1`. Do not treat a general admin flag,
tool permission, or a higher numeric role as equivalent access.

The Central User Manager at `/admin/user-manager` is independent. It manages
the allowlisted multi-tenant Central User Manager integration and does not
replace, share access control with, or operate the local Webook user-management
workflow.

## Editable fields

This release lets a Role 1 administrator edit only a user's name, username,
email, and telephone number. Identity updates are validated and synchronized
with Supabase Auth when the local user record is linked to an Auth user. The
local `public.users.id` is an immutable identifier submitted by the client;
the server authorizes the request and applies field allowlists before the
service updates data.

## Ban and Unban

The migration `20260827120000_webook_user_management.sql` is required before
enabling this route. It adds `public.users.is_banned`, which stores the durable
local Ban state and is part of the Role 1 authorization policy.

An administrator cannot Ban their own account. The server also detects the
current administrator through an email match when a local record has not yet
been linked to an Auth UID.

Ban and Unban keep Supabase Auth and `public.users.is_banned` synchronized:

- **Ban:** apply the Auth ban first, then set local `is_banned` to `true`.
  If the local update fails, remove the Auth ban as compensation.
- **Unban:** remove the Auth ban first, then set local `is_banned` to `false`.
  If the local update fails, reapply the Auth ban as compensation.
- For a local user with no linked Auth account, the lifecycle operation updates
  only the local `is_banned` state.

The client refreshes `/admin/users` only after a successful mutation. Failures
remain in the current dialog so the administrator can see the safe error
message and retry.

## Schema rollout

Apply the migration through the normal Supabase migration workflow before
deploying the application code that uses `/admin/users`. Verify that
`is_banned` exists and that the Role 1 policies are installed. Existing user
records receive `is_banned = false` by default; do not manually infer Ban state
from a missing Auth link.
