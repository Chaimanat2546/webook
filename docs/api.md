# API Notes

## Central User Manager admin API

All routes require the current Supabase Auth UID to match exactly one
`public.users` row with `role_id = 1`.

```text
GET  /api/admin/user-manager/health?tenantId={uuid}
POST /api/admin/user-manager/projects/reactivate
POST /api/admin/user-manager/operations
POST /api/admin/user-manager/operations/{operationId}/reconcile
```

POST requests require the exact
`Content-Type: application/json`, are limited to 16 KiB, reject extra keys,
and accept only their documented fields. Reactivation accepts only
`{ "tenantId": "<uuid>" }`; operation and reconciliation accept `tenantId`,
`operationId`, `action`, and the action-specific payload. The verified actor
UID is supplied server-side. Reconciliation also requires the path and body
operation UUIDs to match.

Every response includes:

```text
Cache-Control: private, no-store, max-age=0
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Responses expose only safe health, operation, user, and stable error fields.
They never expose Tenant Agent destinations, project references, Bearer token
material, ciphertext, IV/KEK metadata, attestation digests, or raw provider
errors. Explicit reconciliation never returns a temporary password.
Reactivation returns only the newly verified safe health summary.

## Tenant Agent Bearer API

The central server calls only the fixed HTTPS origin stored for an active
Tenant and never accepts a Browser-supplied destination. Requests use:

```text
Authorization: Bearer {tenant-specific-256-bit-token}
Content-Type: application/json
```

```text
GET  /api/internal/central-user-manager/v1/health
POST /api/internal/central-user-manager/v1/operations
```

The target Agent verifies its configured Tenant UUID, Supabase project ref,
Agent/schema versions, token version, and Auth-attestation identity. Operation
requests bind Tenant, operation UUID, actor UID, action, normalized payload,
and request hash. Redirects, oversized/non-JSON envelopes, extra fields,
identity mismatches, and unknown statuses fail closed.

Bearer tokens never appear in URLs or response bodies. Health and operation
responses are bounded exact envelopes. Safe results never contain passwords;
a one-time password is transported separately and is returned by the central
admin API only after durable atomic finalization. The full operator lifecycle
is documented in the
[Central User Manager operator guide](central-user-manager.md).

## Advertisement Public Reads

External systems read active advertisements through Supabase Data API:

```text
advertisements?select=id,title,zone,advertisement_images(image_name,image_path,image_order)&is_active=eq.true
```

Filter a specific listing zone and include all-zone advertisements:

```text
advertisements?select=id,title,zone,advertisement_images(image_name,image_path,image_order)&is_active=eq.true&or=(zone.eq.all,zone.eq.pattaya)
```

The API returns `image_path` object keys, not full image URLs. Build display URLs by appending `image_path` to the Worker URL:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_path}
```

Example values for newly uploaded images:

```text
zone: all
image_name: 20260109220657_60b5a9a545.webp
image_path: advertisements/{advertisement_id}/20260109220657_60b5a9a545.webp
```
