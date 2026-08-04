-- Central User Manager control-plane storage and transaction boundaries.
-- Bearer plaintext and temporary passwords must never be stored in these tables.

create schema if not exists private;

create or replace function private.require_central_user_service_role()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.jwt() ->> 'role' <> 'service_role'
    or auth.jwt() ->> 'role' is null
  then
    raise exception using
      errcode = '42501',
      message = 'central_user_manager_service_role_required';
  end if;
end;
$$;

create or replace function private.central_user_safe_json(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_kind text;
  v_key text;
  v_child jsonb;
  v_normalized_key text;
begin
  if p_value is null then
    return true;
  end if;

  v_kind := jsonb_typeof(p_value);
  if v_kind = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      v_normalized_key := regexp_replace(lower(v_key), '[^a-z0-9]', '', 'g');
      if v_normalized_key like '%password%'
        or v_normalized_key like '%bearertoken%'
        or v_normalized_key like '%accesstoken%'
        or v_normalized_key like '%refreshtoken%'
        or v_normalized_key like '%authorization%'
        or v_normalized_key like '%credential%'
        or v_normalized_key like '%secret%'
        or v_normalized_key like '%ciphertext%'
        or v_normalized_key like '%initializationvector%'
        or v_normalized_key like '%fingerprint%'
        or v_normalized_key like '%raw%'
        or v_normalized_key like '%provider%'
        or v_normalized_key like '%destination%'
        or v_normalized_key like '%origin%'
        or v_normalized_key like '%projectref%'
        or v_normalized_key like '%wrangler%'
        or v_normalized_key in ('iv', 'kek', 'value')
      then
        return false;
      end if;
      if not private.central_user_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif v_kind = 'array' then
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if not private.central_user_safe_json(v_child) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

create table public.customer_projects (
  id uuid primary key,
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 120
    and display_name = btrim(display_name)
  ),
  target_supabase_project_ref text not null unique check (
    target_supabase_project_ref ~ '^[a-z0-9]{20}$'
  ),
  agent_origin text not null check (
    agent_origin ~ '^https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
    and agent_origin <> 'https://localhost'
    and position('.' in substring(agent_origin from 9)) > 0
    and agent_origin not like '%..%'
    and agent_origin !~ '(\.-|-\.)'
    and agent_origin !~ '^https://[0-9]+(\.[0-9]+){3}$'
    and agent_origin !~ '^https://.*\.(local|localhost|internal|home|lan|test|invalid|example)$'
  ),
  wrangler_environment text not null check (
    wrangler_environment ~ '^[A-Za-z0-9_-]{1,64}$'
  ),
  is_active boolean not null default false,
  bearer_token_ciphertext text,
  bearer_token_iv text,
  bearer_token_version integer,
  bearer_token_kek_version integer,
  bearer_token_fingerprint text,
  bearer_token_updated_at timestamp with time zone,
  last_verified_token_version integer,
  last_health_checked_at timestamp with time zone,
  last_list_users_checked_at timestamp with time zone,
  last_safe_error_code text check (
    last_safe_error_code is null
    or last_safe_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  created_at timestamp with time zone not null default clock_timestamp(),
  updated_at timestamp with time zone not null default clock_timestamp(),
  constraint customer_projects_bearer_bundle check (
    (
      bearer_token_ciphertext is null
      and bearer_token_iv is null
      and bearer_token_version is null
      and bearer_token_kek_version is null
      and bearer_token_fingerprint is null
      and bearer_token_updated_at is null
    )
    or
    (
      octet_length(bearer_token_ciphertext) = 64
      and bearer_token_ciphertext ~ '^[A-Za-z0-9_-]{64}$'
      and octet_length(bearer_token_iv) = 16
      and bearer_token_iv ~ '^[A-Za-z0-9_-]{16}$'
      and bearer_token_version > 0
      and bearer_token_kek_version > 0
      and bearer_token_fingerprint ~ '^[0-9a-f]{64}$'
      and bearer_token_updated_at is not null
    )
  ),
  constraint customer_projects_activation_proof check (
    not is_active or (
      bearer_token_version = last_verified_token_version
      and last_health_checked_at >= bearer_token_updated_at
      and last_list_users_checked_at >= bearer_token_updated_at
    )
  )
);

create table public.user_management_operations (
  operation_id uuid primary key,
  tenant_id uuid not null
    references public.customer_projects(id) on delete restrict,
  actor_uid uuid not null,
  action text not null check (
    action in (
      'list_users',
      'create_user',
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user'
    )
  ),
  target_email_normalized text,
  request_hash text not null check (
    request_hash ~ '^[0-9a-f]{64}$'
  ),
  status text not null default 'received' check (
    status in (
      'received',
      'dispatching',
      'completed',
      'in_progress',
      'needs_review',
      'quarantined',
      'failed_safe'
    )
  ),
  safe_result jsonb,
  safe_error_code text check (
    safe_error_code is null
    or safe_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  dispatch_attempt_count integer not null default 0 check (
    dispatch_attempt_count >= 0
  ),
  received_at timestamp with time zone not null default clock_timestamp(),
  dispatch_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default clock_timestamp(),
  constraint user_management_operation_target check (
    (action = 'list_users' and target_email_normalized is null)
    or
    (
      action <> 'list_users'
      and target_email_normalized is not null
      and target_email_normalized = lower(btrim(target_email_normalized))
      and char_length(target_email_normalized) between 3 and 254
    )
  ),
  constraint user_management_operation_safe_result check (
    safe_result is null or (
      octet_length(safe_result::text) <= 65536
      and private.central_user_safe_json(safe_result)
    )
  )
);

create index user_management_operations_tenant_received_idx
  on public.user_management_operations (tenant_id, received_at desc);

create index user_management_operations_review_idx
  on public.user_management_operations (status, updated_at)
  where status in ('in_progress', 'needs_review', 'quarantined');

create table public.central_user_audit_events (
  event_id uuid primary key,
  operation_id uuid
    references public.user_management_operations(operation_id) on delete restrict,
  tenant_id uuid not null
    references public.customer_projects(id) on delete restrict,
  actor_uid uuid not null,
  action text not null check (
    action in (
      'list_users',
      'create_user',
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user',
      'register_project',
      'verify_project',
      'activate_project',
      'deactivate_project',
      'rotate_token',
      'rotate_kek',
      'reconcile_operation'
    )
  ),
  outcome text not null check (
    outcome in (
      'received',
      'dispatching',
      'completed',
      'in_progress',
      'needs_review',
      'quarantined',
      'failed_safe',
      'succeeded',
      'failed',
      'retry',
      'conflict'
    )
  ),
  safe_error_code text check (
    safe_error_code is null
    or safe_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  request_hash text check (
    request_hash is null or request_hash ~ '^[0-9a-f]{64}$'
  ),
  occurred_at timestamp with time zone not null default clock_timestamp(),
  metadata jsonb check (
    metadata is null or (
      octet_length(metadata::text) <= 16384
      and private.central_user_safe_json(metadata)
    )
  )
);

create index central_user_audit_tenant_time_idx
  on public.central_user_audit_events (tenant_id, occurred_at desc);

create or replace function private.prevent_central_operation_binding_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.operation_id is distinct from old.operation_id
    or new.tenant_id is distinct from old.tenant_id
    or new.actor_uid is distinct from old.actor_uid
    or new.action is distinct from old.action
    or new.target_email_normalized is distinct from old.target_email_normalized
    or new.request_hash is distinct from old.request_hash
    or new.received_at is distinct from old.received_at
  then
    raise exception using
      errcode = '23514',
      message = 'central_user_operation_binding_is_immutable';
  end if;
  return new;
end;
$$;

create trigger prevent_central_operation_binding_update
before update on public.user_management_operations
for each row execute function private.prevent_central_operation_binding_update();

create or replace function private.prevent_central_user_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'central_user_audit_is_append_only';
end;
$$;

create trigger prevent_central_user_audit_mutation
before update or delete on public.central_user_audit_events
for each row execute function private.prevent_central_user_audit_mutation();

alter table public.customer_projects enable row level security;
alter table public.user_management_operations enable row level security;
alter table public.central_user_audit_events enable row level security;

revoke all privileges on table public.customer_projects
  from public, anon, authenticated, service_role;
revoke all privileges on table public.user_management_operations
  from public, anon, authenticated, service_role;
revoke all privileges on table public.central_user_audit_events
  from public, anon, authenticated, service_role;

create view public.central_user_manager_projects
with (security_invoker = true)
as
select
  id,
  display_name,
  is_active,
  last_verified_token_version,
  last_health_checked_at,
  last_list_users_checked_at,
  created_at,
  updated_at
from public.customer_projects;

revoke all privileges on table public.central_user_manager_projects
  from public, anon, authenticated, service_role;
grant select on public.central_user_manager_projects to service_role;
grant select on public.customer_projects to service_role;
grant select on public.user_management_operations to service_role;
grant select on public.central_user_audit_events to service_role;

create function private.register_customer_project(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_existing public.customer_projects%rowtype;
begin
  perform private.require_central_user_service_role();

  insert into public.customer_projects (
    id,
    display_name,
    target_supabase_project_ref,
    agent_origin,
    wrangler_environment,
    is_active
  )
  values (
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment,
    false
  )
  on conflict do nothing;

  if found then
    return jsonb_build_object('outcome', 'registered', 'isActive', false);
  end if;

  select *
  into v_existing
  from public.customer_projects
  where id = p_tenant_id;

  if found
    and v_existing.display_name is not distinct from p_display_name
    and v_existing.target_supabase_project_ref is not distinct from p_target_supabase_project_ref
    and v_existing.agent_origin is not distinct from p_agent_origin
    and v_existing.wrangler_environment is not distinct from p_wrangler_environment
    and v_existing.is_active = false
  then
    return jsonb_build_object('outcome', 'retry', 'isActive', false);
  end if;

  raise exception using
    errcode = '23505',
    message = 'central_user_manager_project_registration_conflict';
end;
$$;

create function private.claim_central_user_operation(
  p_operation_id uuid,
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_action text,
  p_target_email_normalized text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_existing public.user_management_operations%rowtype;
begin
  perform private.require_central_user_service_role();

  insert into public.user_management_operations (
    operation_id,
    tenant_id,
    actor_uid,
    action,
    target_email_normalized,
    request_hash
  )
  values (
    p_operation_id,
    p_tenant_id,
    p_actor_uid,
    p_action,
    p_target_email_normalized,
    p_request_hash
  )
  on conflict (operation_id) do nothing;

  if found then
    return jsonb_build_object('outcome', 'claimed', 'status', 'received');
  end if;

  select *
  into v_existing
  from public.user_management_operations
  where operation_id = p_operation_id;

  if v_existing.tenant_id is not distinct from p_tenant_id
    and v_existing.actor_uid is not distinct from p_actor_uid
    and v_existing.action is not distinct from p_action
    and v_existing.target_email_normalized is not distinct from p_target_email_normalized
    and v_existing.request_hash is not distinct from p_request_hash
  then
    return jsonb_build_object(
      'outcome', 'retry',
      'status', v_existing.status,
      'safeResult', v_existing.safe_result,
      'safeErrorCode', v_existing.safe_error_code
    );
  end if;

  raise exception using
    errcode = '23505',
    message = 'central_user_operation_id_conflict';
end;
$$;

create function private.begin_central_user_dispatch(
  p_operation_id uuid,
  p_request_hash text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.user_management_operations
  set
    status = 'dispatching',
    dispatch_attempt_count = dispatch_attempt_count + 1,
    dispatch_started_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where operation_id = p_operation_id
    and request_hash = p_request_hash
    and status = 'received';

  return found;
end;
$$;

create function private.complete_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_safe_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.user_management_operations
  set
    status = 'completed',
    safe_result = p_safe_result,
    safe_error_code = null,
    completed_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where operation_id = p_operation_id
    and request_hash = p_request_hash
    and status in ('dispatching', 'in_progress');

  return found;
end;
$$;

create function private.mark_central_user_operation_ambiguous(
  p_operation_id uuid,
  p_request_hash text,
  p_status text,
  p_safe_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_status not in ('in_progress', 'needs_review', 'quarantined') then
    raise exception using
      errcode = '22023',
      message = 'central_user_operation_invalid_ambiguous_status';
  end if;

  update public.user_management_operations
  set
    status = p_status,
    safe_error_code = p_safe_error_code,
    updated_at = clock_timestamp()
  where operation_id = p_operation_id
    and request_hash = p_request_hash
    and status = 'dispatching';

  return found;
end;
$$;

create function private.reconcile_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_expected_status text,
  p_next_status text,
  p_safe_result jsonb,
  p_safe_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_expected_status not in ('in_progress', 'needs_review', 'quarantined')
    or p_next_status not in ('completed', 'failed_safe', 'quarantined')
  then
    raise exception using
      errcode = '22023',
      message = 'central_user_operation_invalid_reconciliation';
  end if;

  update public.user_management_operations
  set
    status = p_next_status,
    safe_result = p_safe_result,
    safe_error_code = p_safe_error_code,
    completed_at = case
      when p_next_status in ('completed', 'failed_safe') then clock_timestamp()
      else completed_at
    end,
    updated_at = clock_timestamp()
  where operation_id = p_operation_id
    and request_hash = p_request_hash
    and status = p_expected_status;

  return found;
end;
$$;

create function private.append_central_user_audit_event(
  p_event_id uuid,
  p_operation_id uuid,
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_action text,
  p_outcome text,
  p_safe_error_code text,
  p_request_hash text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  insert into public.central_user_audit_events (
    event_id,
    operation_id,
    tenant_id,
    actor_uid,
    action,
    outcome,
    safe_error_code,
    request_hash,
    metadata
  )
  values (
    p_event_id,
    p_operation_id,
    p_tenant_id,
    p_actor_uid,
    p_action,
    p_outcome,
    p_safe_error_code,
    p_request_hash,
    p_metadata
  );

  return p_event_id;
end;
$$;

create function private.deactivate_customer_project(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.customer_projects
  set
    is_active = false,
    last_verified_token_version = null,
    last_health_checked_at = null,
    last_list_users_checked_at = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id;

  return found;
end;
$$;

create function private.rotate_customer_project_bearer(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_next_token_version integer,
  p_kek_version integer,
  p_ciphertext text,
  p_iv text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_next_token_version <> p_expected_token_version + 1 then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_token_version_must_increment';
  end if;

  if p_expected_token_version = 0 and p_next_token_version <> 1 then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_initial_token_version_must_be_one';
  end if;

  update public.customer_projects
  set
    is_active = false,
    bearer_token_ciphertext = p_ciphertext,
    bearer_token_iv = p_iv,
    bearer_token_version = p_next_token_version,
    bearer_token_kek_version = p_kek_version,
    bearer_token_fingerprint = p_fingerprint,
    bearer_token_updated_at = clock_timestamp(),
    last_verified_token_version = null,
    last_health_checked_at = null,
    last_list_users_checked_at = null,
    last_safe_error_code = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and coalesce(bearer_token_version, 0) = p_expected_token_version;

  return found;
end;
$$;

create function private.record_customer_project_verification(
  p_tenant_id uuid,
  p_token_version integer,
  p_check text,
  p_succeeded boolean,
  p_safe_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_check not in ('health', 'list_users') then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_invalid_verification_check';
  end if;

  if not p_succeeded then
    update public.customer_projects
    set
      last_verified_token_version = null,
      last_health_checked_at = case
        when p_check = 'health' then null
        else last_health_checked_at
      end,
      last_list_users_checked_at = case
        when p_check = 'list_users' then null
        else last_list_users_checked_at
      end,
      last_safe_error_code = p_safe_error_code,
      updated_at = clock_timestamp()
    where id = p_tenant_id
      and is_active = false
      and bearer_token_version = p_token_version;

    return found;
  end if;

  update public.customer_projects
  set
    last_verified_token_version = p_token_version,
    last_health_checked_at = case
      when p_check = 'health' then clock_timestamp()
      else last_health_checked_at
    end,
    last_list_users_checked_at = case
      when p_check = 'list_users' then clock_timestamp()
      else last_list_users_checked_at
    end,
    last_safe_error_code = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_token_version;

  return found;
end;
$$;

create function private.activate_customer_project(
  p_tenant_id uuid,
  p_expected_token_version integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.customer_projects
  set is_active = true, updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_expected_token_version
    and bearer_token_version = last_verified_token_version
    and last_health_checked_at >= bearer_token_updated_at
    and last_list_users_checked_at >= bearer_token_updated_at;

  return found;
end;
$$;

create function public.claim_central_user_operation(
  p_operation_id uuid,
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_action text,
  p_target_email_normalized text,
  p_request_hash text
)
returns jsonb
language sql
set search_path = pg_catalog, public, private
as $$
  select private.claim_central_user_operation(
    p_operation_id,
    p_tenant_id,
    p_actor_uid,
    p_action,
    p_target_email_normalized,
    p_request_hash
  );
$$;

create function public.register_customer_project(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text
)
returns jsonb
language sql
set search_path = pg_catalog, public, private
as $$
  select private.register_customer_project(
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment
  );
$$;

create function public.begin_central_user_dispatch(
  p_operation_id uuid,
  p_request_hash text
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.begin_central_user_dispatch(p_operation_id, p_request_hash);
$$;

create function public.complete_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_safe_result jsonb
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.complete_central_user_operation(
    p_operation_id,
    p_request_hash,
    p_safe_result
  );
$$;

create function public.mark_central_user_operation_ambiguous(
  p_operation_id uuid,
  p_request_hash text,
  p_status text,
  p_safe_error_code text
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.mark_central_user_operation_ambiguous(
    p_operation_id,
    p_request_hash,
    p_status,
    p_safe_error_code
  );
$$;

create function public.reconcile_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_expected_status text,
  p_next_status text,
  p_safe_result jsonb,
  p_safe_error_code text
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.reconcile_central_user_operation(
    p_operation_id,
    p_request_hash,
    p_expected_status,
    p_next_status,
    p_safe_result,
    p_safe_error_code
  );
$$;

create function public.append_central_user_audit_event(
  p_event_id uuid,
  p_operation_id uuid,
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_action text,
  p_outcome text,
  p_safe_error_code text,
  p_request_hash text,
  p_metadata jsonb
)
returns uuid
language sql
set search_path = pg_catalog, public, private
as $$
  select private.append_central_user_audit_event(
    p_event_id,
    p_operation_id,
    p_tenant_id,
    p_actor_uid,
    p_action,
    p_outcome,
    p_safe_error_code,
    p_request_hash,
    p_metadata
  );
$$;

create function public.deactivate_customer_project(p_tenant_id uuid)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.deactivate_customer_project(p_tenant_id);
$$;

create function public.rotate_customer_project_bearer(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_next_token_version integer,
  p_kek_version integer,
  p_ciphertext text,
  p_iv text,
  p_fingerprint text
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.rotate_customer_project_bearer(
    p_tenant_id,
    p_expected_token_version,
    p_next_token_version,
    p_kek_version,
    p_ciphertext,
    p_iv,
    p_fingerprint
  );
$$;

create function public.record_customer_project_verification(
  p_tenant_id uuid,
  p_token_version integer,
  p_check text,
  p_succeeded boolean,
  p_safe_error_code text
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.record_customer_project_verification(
    p_tenant_id,
    p_token_version,
    p_check,
    p_succeeded,
    p_safe_error_code
  );
$$;

create function public.activate_customer_project(
  p_tenant_id uuid,
  p_expected_token_version integer
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.activate_customer_project(
    p_tenant_id,
    p_expected_token_version
  );
$$;

revoke all on function private.require_central_user_service_role()
  from public, anon, authenticated, service_role;
revoke all on function private.central_user_safe_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.prevent_central_operation_binding_update()
  from public, anon, authenticated, service_role;
revoke all on function private.prevent_central_user_audit_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.register_customer_project(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.claim_central_user_operation(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.begin_central_user_dispatch(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_central_user_operation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.mark_central_user_operation_ambiguous(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.append_central_user_audit_event(uuid, uuid, uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.deactivate_customer_project(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.rotate_customer_project_bearer(uuid, integer, integer, integer, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.record_customer_project_verification(uuid, integer, text, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function private.activate_customer_project(uuid, integer)
  from public, anon, authenticated, service_role;

revoke all on function public.register_customer_project(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_central_user_operation(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.begin_central_user_dispatch(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_central_user_operation(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_central_user_operation_ambiguous(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.append_central_user_audit_event(uuid, uuid, uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.deactivate_customer_project(uuid)
  from public, anon, authenticated;
revoke all on function public.rotate_customer_project_bearer(uuid, integer, integer, integer, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_customer_project_verification(uuid, integer, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.activate_customer_project(uuid, integer)
  from public, anon, authenticated;

grant execute on function private.claim_central_user_operation(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function private.register_customer_project(uuid, text, text, text, text)
  to service_role;
grant execute on function private.begin_central_user_dispatch(uuid, text)
  to service_role;
grant execute on function private.complete_central_user_operation(uuid, text, jsonb)
  to service_role;
grant execute on function private.mark_central_user_operation_ambiguous(uuid, text, text, text)
  to service_role;
grant execute on function private.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  to service_role;
grant execute on function private.append_central_user_audit_event(uuid, uuid, uuid, uuid, text, text, text, text, jsonb)
  to service_role;
grant execute on function private.deactivate_customer_project(uuid)
  to service_role;
grant execute on function private.rotate_customer_project_bearer(uuid, integer, integer, integer, text, text, text)
  to service_role;
grant execute on function private.record_customer_project_verification(uuid, integer, text, boolean, text)
  to service_role;
grant execute on function private.activate_customer_project(uuid, integer)
  to service_role;
grant usage on schema private to service_role;

grant execute on function public.claim_central_user_operation(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.register_customer_project(uuid, text, text, text, text)
  to service_role;
grant execute on function public.begin_central_user_dispatch(uuid, text)
  to service_role;
grant execute on function public.complete_central_user_operation(uuid, text, jsonb)
  to service_role;
grant execute on function public.mark_central_user_operation_ambiguous(uuid, text, text, text)
  to service_role;
grant execute on function public.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  to service_role;
grant execute on function public.append_central_user_audit_event(uuid, uuid, uuid, uuid, text, text, text, text, jsonb)
  to service_role;
grant execute on function public.deactivate_customer_project(uuid)
  to service_role;
grant execute on function public.rotate_customer_project_bearer(uuid, integer, integer, integer, text, text, text)
  to service_role;
grant execute on function public.record_customer_project_verification(uuid, integer, text, boolean, text)
  to service_role;
grant execute on function public.activate_customer_project(uuid, integer)
  to service_role;

notify pgrst, 'reload schema';
