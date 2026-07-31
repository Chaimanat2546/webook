# Central User Manager operator guide

Central User Manager is a Bearer-only control plane for administering users in
separate Tenant Supabase projects. Each Tenant owns one independent random
256-bit Bearer token. `webook` stores only an AES-GCM encrypted copy; the
Tenant Agent stores the matching secret in its own Cloudflare Worker.

Possession of the Bearer token grants the Agent capability. Bearer-only is not
equivalent to Access plus Ed25519: it has no request-signing key separation,
so token disclosure is a full capability disclosure. Keep the token and both
KEKs in a secret manager, never in Git, chat, URLs, command arguments, browser
storage, logs, or screenshots.

## Required operator access

- The operator UID must match exactly one `public.users.uid` row with
  `role_id = 1`.
- `SUPABASE_SERVICE_ROLE_KEY` is for the central registry only.
- `SUPABASE_ACCESS_TOKEN` reads the target Supabase Auth configuration.
- `CLOUDFLARE_API_TOKEN` may access only the target account/Worker needed for
  secret installation and deployment.
- The target repo must already contain the approved Agent routes and exact
  Wrangler environment variables. The CLI does not edit the target repo.

The CLI validates the target Cloudflare account and Worker before changing a
secret. Central Supabase credentials, the Management API token, and the KEK
are excluded from every target subprocess. The Cloudflare token is excluded
from the target build and is present only for Wrangler secret/deploy calls.

The target Supabase Auth policy must disable public signup and anonymous
sign-in, use the approved exact password character set with minimum length 8,
report an explicit Have I Been Pwned password-check setting, and keep password
update reauthentication disabled. The CLI binds this exact policy into the
Tenant health attestation and fails closed if it changes.

## Add a Tenant

The default is validation-only:

```powershell
npm.cmd run central-user-manager:provision -- `
  --tenant-id TENANT_UUID `
  --display-name "Tenant name" `
  --target-project-ref TWENTY_CHARACTER_PROJECT_REF `
  --agent-origin https://agent.example.co.th `
  --wrangler-environment production `
  --target-repo C:\absolute\path\to\target `
  --operator-uid OPERATOR_AUTH_UID `
  --agent-version 1.0.0 `
  --schema-version 1.0.0 `
  --cloudflare-account-id CLOUDFLARE_ACCOUNT_ID `
  --worker-name TARGET_WORKER_NAME
```

Review the target configuration, then rerun with `--apply`. Enter the
canonical 43-character base64url Tenant token through the hidden terminal
prompt or stdin. Never add the token to the command.

The fail-closed order is:

1. Verify the exact role-1 operator and target Supabase Auth policy.
2. Register the Tenant inactive.
3. Install the target Worker secret.
4. Encrypt and store the central copy.
5. Build and deploy only the target repo.
6. Verify exact health identity and a bounded `list_users`.
7. Activate the Tenant.

Adding another Tenant changes registry data and the selected target Worker;
it does not rebuild or deploy `webook`.

## Immediate Tenant token rotation

Rotation causes intentional Tenant-specific downtime. Use the same command
with:

```text
--rotate --expected-token-version CURRENT_POSITIVE_VERSION --apply
```

Before accepting the new token, the database atomically deactivates the
Tenant, converts unstarted operations to `failed_safe`, quarantines
dispatched/ambiguous operations, and records audits. The CLI then installs the
new target secret, stores the incremented encrypted version, deploys only that
target, verifies it, and reactivates it.

The workflow is resumable:

- Registered but no central token: rerun and enter a token.
- Target secret changed but central storage failed: rerun while the Tenant
  remains rotation-gated; install a new chosen token if the prior value is no
  longer available.
- Central token stored but target build/deploy or checks failed: rerun; the
  stored token is decrypted only in process and reinstalled automatically.
- Activation committed but the response was lost: rerun; exact completed
  state and Auth attestation return success without another deploy.

Do not manually call legacy register, token-write, or activation RPCs. Their
service-role execute privileges are revoked so state and audit transitions
cannot be bypassed.

## Deactivation and incident handling

Deactivation is a control-plane action, not a token delete. A deliberately
deactivated Tenant is not treated as a resumable provisioning phase; it needs
an explicit approved reactivation/repair decision. For ambiguous mutations,
inspect the original operation and use explicit reconciliation; never replay
it under a new operation UUID.

If an already configured Tenant is automatically deactivated after a failed
Agent verification, `/admin/user-manager` labels it
`ต้องเปิดใช้งานใหม่`. Select the Tenant and choose
`ตรวจสอบและเปิดใช้งานอีกครั้ง`. The central Worker reuses the stored encrypted
Bearer without rotating it or deploying the target, records fresh exact health
and bounded `list_users` proofs under one attempt UUID, and activates only if
both succeed. A failed check keeps the Tenant inactive; fix the Agent,
destination, or secret mismatch and retry the same action. Do not use normal
health or user-operation routes to bypass this gate.

A one-time password exists only in the first successful create/reissue HTTP
response. If that response is lost, reconciliation intentionally does not
return the password. Perform a new approved password reissue with a new
operation UUID after the previous operation is terminal.

Useful privacy-safe incident queries:

```sql
select id, display_name, is_active, provisioning_state,
       bearer_token_version, bearer_token_kek_version,
       last_health_status, updated_at
from public.customer_projects
order by display_name;

select operation_id, tenant_id, action, status, agent_stage,
       safe_error_code, updated_at
from public.user_management_operations
where status in ('in_progress', 'needs_review', 'quarantined')
order by updated_at;

select event_id, tenant_id, operation_id, action, outcome,
       safe_error_code, metadata, occurred_at
from public.central_user_audit_events
order by occurred_at desc
limit 200;
```

Do not select ciphertext, IVs, fingerprints, request bodies, raw provider
responses, or temporary passwords into tickets or analytics. Audit metadata is
allowlisted and password-free.

## KEK rotation

KEK rotation re-encrypts the same Tenant token with a fresh 96-bit IV. It does
not change the Tenant token, token version, fingerprint, Agent secret, health
proof, or active state.

1. Create a new independent 256-bit canonical base64url key in the approved
   secret manager and increment the positive KEK version.
2. Configure the new key/version as
   `CENTRAL_USER_MANAGER_TOKEN_KEK(_VERSION)` and the old pair as
   `CENTRAL_USER_MANAGER_TOKEN_KEK_PREVIOUS(_VERSION)`.
3. Restart/deploy `webook` with both pairs before rewrapping. Keep both until
   the removal gate reports zero old-version rows.
4. Dry run:

```powershell
npm.cmd run central-user-manager:rotate-kek -- `
  --operator-uid OPERATOR_AUTH_UID `
  --from-kek-version OLD_VERSION `
  --to-kek-version NEW_VERSION `
  --batch-size 50
```

5. Rerun with `--apply`. Each row uses an exact compare-and-swap update and an
   atomic `rotate_kek` audit, so interruption is safe to resume.
6. Repeat the dry run. Remove the previous-key pair only after it reports zero
   rows on the old version, then restart/deploy `webook` again.

If any row fails authentication, CAS, or persistence, keep both KEKs and
investigate. Never overwrite the old key or force-update KEK version columns.
