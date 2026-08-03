create table public.central_user_audit_events (
  operation_id uuid primary key,
  tenant_id uuid not null,
  actor_uid uuid not null,
  action text not null check (action in (
    'list_users',
    'create_user',
    'reissue_temporary_password',
    'suspend_user',
    'reactivate_user'
  )),
  status text not null check (status in (
    'started',
    'completed',
    'in_progress',
    'needs_review',
    'quarantined',
    'failed'
  )),
  safe_error_code text check (safe_error_code is null or char_length(safe_error_code) <= 64),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint central_user_audit_terminal_state check (
    (status in ('completed', 'needs_review', 'quarantined', 'failed') and completed_at is not null)
    or (status in ('started', 'in_progress') and completed_at is null)
  ),
  constraint central_user_audit_terminal_error check (
    (status = 'failed' and safe_error_code is not null)
    or (status <> 'failed' and safe_error_code is null)
  )
);

create index central_user_audit_tenant_time_idx
  on public.central_user_audit_events (tenant_id, created_at desc);

alter table public.central_user_audit_events enable row level security;
alter table public.central_user_audit_events force row level security;

revoke all on table public.central_user_audit_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.central_user_audit_events to service_role;
