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
with Supabase Auth when the local user record is linked by Auth UID. The same
synchronization applies when the current administrator is resolved through the
email fallback, so a self-email edit does not break that administrator's next
login. The local `public.users.id` is an immutable identifier submitted by the
client; the server authorizes the request and applies field allowlists before
the service updates data.

A Role 1 administrator may edit their own details. Self-edit and self-Ban are
separate permissions: the application rejects an attempt to Ban the current
administrator even though that administrator can update their own allowed
profile fields.

## Ban and Unban

The ordered migrations listed in [Schema rollout](#schema-rollout) are required
before enabling this route. `public.users.is_banned` stores the durable local
Ban state and is part of the Role 1 authorization check.

An administrator cannot Ban their own account. The server also detects the
current administrator through an email match when a local record has not yet
been linked to an Auth UID.

Ban and Unban keep Supabase Auth and `public.users.is_banned` synchronized:

- **Ban:** apply the Auth ban first, then set local `is_banned` to `true`.
  If the local update fails, remove the Auth ban as compensation.
- **Unban:** remove the Auth ban first, then set local `is_banned` to `false`.
  If the local update fails, reapply the Auth ban as compensation.
- For a local user with no linked Auth account, Ban/Unban updates only the local
  `is_banned` state.

All cross-system mutations for the same managed record use two serialization
layers. A per-process FIFO avoids unnecessary collisions inside one Worker
isolate. The correctness boundary is a server-only database lease keyed by
`public.users.id`: the service must acquire it before any Supabase Auth
mutation, and the local detail/Ban function must present the same unexpired
fencing token. A competing Worker isolate that cannot acquire the lease returns
a safe failure without starting an Auth mutation; the administrator may retry
after the active operation finishes. The service releases the lease after
success or compensation, and abandoned leases expire after five minutes.

Email compensation reads the prior email directly from Supabase Auth before
changing it; it does not use a nullable or stale local email as the rollback
source.

A Supabase Auth Ban does not immediately revoke an already-issued JWT. On the
next protected Webook request that executes `requireAdmin()`, the application
loads the current local `is_banned` value. A banned user is signed out and
redirected to `/login?error=invalid`, so Webook does not wait for that JWT to
expire before enforcing the local Ban. Services that bypass `requireAdmin()`
must not be treated as covered by this application-level check.

The client refreshes `/admin/users` only after a successful mutation. Failures
remain in the current dialog so the administrator can see the safe error
message and retry.

## Schema rollout

Apply these migrations in timestamp order through the normal Supabase migration
workflow before deploying the application code that uses `/admin/users`:

1. `20260827120000_webook_user_management.sql` adds `is_banned`, the Role 1
   authorization helper, and the initial RLS policies.
2. `20260827150000_atomic_webook_user_update.sql` adds the transaction-locked
   identity update function.
3. `20260827180000_harden_webook_user_management.sql` removes broad browser DML,
   permits manager reads and self-detail edits, adds the private per-record
   lifecycle lease, and restricts lock/detail/Ban functions to the server-side
   `service_role` lifecycle path.

The first two migrations are both prerequisites; the hardening migration must
follow them. Verify that `is_banned` exists, the final Role 1 policy is
select-only, authenticated and anonymous roles have no direct table-write or
mutation-function access, and both mutation functions are executable only by
`service_role`. Also verify that `private.webook_user_lifecycle_locks` and its
service-role-only acquire/release functions exist. Existing user records receive
`is_banned = false` by default; do not manually infer Ban state from a missing
Auth link.
