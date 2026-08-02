# Multi-tenant User Manager UI

## Goal

Restore the three-column User Manager experience from commit `25822d7` while
keeping the current named-RPC, service-binding security boundary. The page
must support any number of pre-approved tenants without allowing a browser to
choose a Worker destination.

## UI

- Left column: a Tenant list with display name and environment label.
- Centre column: the selected Tenant's paginated user list.
- Right column: selected Tenant summary and the five supported operations:
  list users, create user, reissue temporary password, suspend user, and
  reactivate user.
- Create and lifecycle operations use the prior dialog pattern. Temporary
  passwords appear only in the existing acknowledgement dialog and are cleared
  from client state when dismissed.
- Non-terminal RPC outcomes show their existing safe status guidance, never a
  successful-completion message.

The removed HTTP health, reconciliation, and Tenant-activation controls are
not restored. They are outside the five supported operations and would weaken
the closed HTTP boundary.

## Tenant boundary

- A server-only, compile-time registry owns each allowed tenant's stable key,
  display name, environment label, tenant UUID, and enabled state.
- The browser may submit only the registry key. Server actions resolve that key
  to the tenant UUID and reject an unknown or disabled key before an RPC call.
- The Cloudflare binding module uses one explicit branch per registry tenant;
  it never derives an environment-binding name from browser input.
- Every tenant needs its own typed named binding in `cloudflare-env.d.ts` and
  explicit Service Binding in `wrangler.staging.jsonc`.
- Adding a tenant requires updating the registry, the explicit binding types
  and Wrangler config, then redeploying `webook-staging` in `chaymanus2003`.

## Initial state

The registry initially contains the existing enabled Staging tenant only.
The page is ready to render further tenants after their approved binding and
registry entries are added; it does not invent or expose unbound tenants.

## Tenant selection and paging

- Selecting a Tenant immediately requests page 1 of that Tenant's users; the
  initially selected Tenant follows the same rule when the page opens.
- The browser sends the fixed server-validated payload `{ page: 1,
  pageSize: 10 }`; it no longer exposes page or page-size inputs.
- The user list supplies Previous and Next controls. Previous is unavailable
  on page 1 and Next is unavailable when the Tenant response reports no next
  page. Each control requests the adjacent page with the same fixed page size.
- While a list request is pending, the selected Tenant remains visible and the
  list area communicates that it is loading. A safe request failure appears in
  the same area without clearing the selected Tenant.
- A successful create, password reissue, suspend, or reactivate operation
  reloads the currently displayed list page so the status stays current.

## Verification

- Tests prove unknown/disabled registry keys cannot invoke a tenant.
- Tests prove each known tenant resolves only to its explicit binding.
- UI tests cover tenant selection, user-list loading/empty state, dialogs, and
  safe non-terminal status messages.
- UI tests cover immediate initial/Tenant-selection loading, the fixed
  ten-user page payload, and bounded Previous/Next navigation.
- Run typecheck, lint, the full test suite, a production build, and staging
  deployment verification before release.
