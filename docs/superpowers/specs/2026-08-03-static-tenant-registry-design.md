# Static Tenant Registry for Central User Manager

## Goal

Allow one `webook-admin` Worker to manage users for multiple approved Tenant
Workers in the same Cloudflare account, while retaining the current named RPC
Service Binding boundary. Adding a Tenant is an operator/developer deployment
task, not an admin UI action.

## Scope

- Keep `baanparty` as the first production Tenant.
- Support any number of enabled or disabled Tenants in the existing User
  Manager UI.
- Require an explicit Service Binding per Tenant.
- Keep Webook's Supabase database independent from each Tenant database.

This change does not add a Tenant-management screen, dynamic Worker URLs,
HTTP/Bearer fallbacks, or a Tenant registry table.

## Architecture

`server/central-user-manager/tenant-bindings.ts` is the server-owned,
compile-time registry. Every entry has a stable browser-safe `key`, canonical
Tenant UUID, display name, environment label, and `enabled` flag.

The browser submits only `tenantKey`. Webook resolves it server-side and
rejects unknown or disabled entries before it creates an RPC request. The
Cloudflare binding adapter selects the target through explicit branches such
as `tenant.key === "baanparty"`; it never indexes `env` with input-derived
text and never receives a Worker name or URL from the browser.

Each registry entry must have exactly one corresponding typed Service Binding
and Wrangler `services` entry pointing to the Tenant Worker's
`CentralUserManagerEntrypoint`. All Workers must remain in the same Cloudflare
account as `webook-admin`.

## Tenant Provisioning Contract

For every new Tenant, the operator must:

1. Prepare and verify the Tenant Worker's Central User Manager configuration,
   secrets, and database before its first enabled deployment.
2. Set its immutable Tenant UUID and its own Supabase project configuration.
3. Add the Tenant registry entry in Webook.
4. Add the matching typed binding and explicit `wrangler.jsonc` service
   binding in Webook.
5. Deploy the enabled Tenant Worker, then deploy `webook-admin` with its
   static binding and registry entry.
6. Verify `list_users` and the five supported user operations with a
   disposable staging user before enabling real use.

Adding a new Tenant necessarily requires a Webook deploy, because Cloudflare
Service Bindings are static deployment configuration.

## Error Handling and Security

- Unknown, malformed, or disabled tenant keys return the existing safe invalid
  request result and make no target RPC call.
- Missing bindings and target RPC failures retain the existing safe server
  error behavior and audit logging.
- Tenant IDs, Worker names, binding names, Cloudflare account IDs, project
  refs, and server credentials never enter the browser payload.
- The public HTTP boundary remains closed; no direct Tenant HTTP management
  endpoint is added.

## Testing

- Registry tests verify public metadata, UUID resolution, and unknown/disabled
  rejection.
- Binding tests verify a one-to-one registry/configuration relationship and
  explicit binding selection without dynamic environment access.
- Server-action tests verify only a registry key is accepted from the browser.
- Existing User Manager tests verify selection, paging, and user operations
  continue to work for every enabled configured Tenant.

## Acceptance Criteria

- A second pre-approved Worker can be added without changing the User Manager
  protocol or exposing a dynamic Worker destination.
- Selecting a configured enabled Tenant loads and manages only that Tenant's
  users.
- An unknown or disabled Tenant cannot invoke any Service Binding.
- `baanparty` continues to work unchanged after the registry is generalized.
