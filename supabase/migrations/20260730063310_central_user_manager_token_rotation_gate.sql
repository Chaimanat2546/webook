alter table public.customer_projects
  add column provisioning_state text;

alter table public.customer_projects
  add constraint customer_projects_provisioning_state check (
    provisioning_state is null
    or provisioning_state in (
      'registered',
      'rotation_gated',
      'token_stored',
      'completed'
    )
  );

create function private.register_customer_project_for_provisioning(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text,
  p_expected_agent_version text,
  p_expected_schema_version text,
  p_auth_attestation_version text,
  p_auth_attestation_digest text,
  p_auth_attestation_checked_at timestamp with time zone,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_result jsonb;
begin
  v_result := private.register_customer_project(
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment,
    p_expected_agent_version,
    p_expected_schema_version,
    p_auth_attestation_version,
    p_auth_attestation_digest,
    p_auth_attestation_checked_at
  );

  update public.customer_projects
  set
    provisioning_state = 'registered',
    updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version is null
    and (
      (v_result ->> 'outcome' = 'registered' and provisioning_state is null)
      or
      (v_result ->> 'outcome' = 'retry' and provisioning_state = 'registered')
    );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'central_user_manager_invalid_provisioning_state';
  end if;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'register_project',
    'succeeded', null, null,
    jsonb_build_object('status', 'registered')
  );

  return v_result;
end;
$$;

create function public.register_customer_project_for_provisioning(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text,
  p_expected_agent_version text,
  p_expected_schema_version text,
  p_auth_attestation_version text,
  p_auth_attestation_digest text,
  p_auth_attestation_checked_at timestamp with time zone,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.register_customer_project_for_provisioning(
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment,
    p_expected_agent_version,
    p_expected_schema_version,
    p_auth_attestation_version,
    p_auth_attestation_digest,
    p_auth_attestation_checked_at,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.register_customer_project_for_provisioning(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.register_customer_project_for_provisioning(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone, uuid, uuid
) to service_role;
revoke all on function public.register_customer_project_for_provisioning(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.register_customer_project_for_provisioning(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone, uuid, uuid
) to service_role;

create function private.begin_customer_project_token_rotation(
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_event_id uuid,
  p_expected_token_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project public.customer_projects%rowtype;
  v_operation public.user_management_operations%rowtype;
  v_failed_safe_count integer := 0;
  v_quarantined_count integer := 0;
  v_remaining_count integer := 0;
begin
  perform private.require_central_user_service_role();

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and is_active = true
    and bearer_token_version = p_expected_token_version
  for update;

  if not found then
    return null;
  end if;

  update public.customer_projects
  set
    is_active = false,
    provisioning_state = 'rotation_gated',
    last_verified_token_version = null,
    last_health_status = 'unknown',
    last_health_safe_error = null,
    last_health_protocol_version = null,
    last_health_tenant_id = null,
    last_health_project_ref = null,
    last_health_agent_version = null,
    last_health_schema_version = null,
    last_health_auth_attestation_version = null,
    last_health_auth_attestation_digest = null,
    last_health_auth_attestation_checked_at = null,
    last_health_checked_at = null,
    last_list_users_checked_at = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id;

  for v_operation in
    update public.user_management_operations
    set
      status = 'failed_safe',
      safe_result = null,
      safe_error_code = 'project_unavailable',
      completed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and status = 'received'
    returning *
  loop
    v_failed_safe_count := v_failed_safe_count + 1;
    insert into public.central_user_audit_events (
      event_id, operation_id, tenant_id, actor_uid, action, outcome,
      safe_error_code, request_hash, metadata
    )
    values (
      gen_random_uuid(), v_operation.operation_id, p_tenant_id, p_actor_uid,
      v_operation.action, 'failed_safe', 'project_unavailable',
      v_operation.request_hash, jsonb_build_object('status', 'token_rotation_gate')
    );
  end loop;

  for v_operation in
    update public.user_management_operations
    set
      status = 'quarantined',
      safe_result = null,
      safe_error_code = 'operation_ambiguous',
      completed_at = null,
      updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and status in ('dispatching', 'in_progress', 'needs_review')
    returning *
  loop
    v_quarantined_count := v_quarantined_count + 1;
    insert into public.central_user_audit_events (
      event_id, operation_id, tenant_id, actor_uid, action, outcome,
      safe_error_code, request_hash, metadata
    )
    values (
      gen_random_uuid(), v_operation.operation_id, p_tenant_id, p_actor_uid,
      v_operation.action, 'quarantined', 'operation_ambiguous',
      v_operation.request_hash, jsonb_build_object('status', 'token_rotation_gate')
    );
  end loop;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'deactivate_project',
    'succeeded', null, null, jsonb_build_object('status', 'token_rotation_gate')
  );

  select count(*)
  into v_remaining_count
  from public.user_management_operations
  where tenant_id = p_tenant_id
    and status in ('received', 'dispatching', 'in_progress', 'needs_review');

  return jsonb_build_object(
    'failedSafeCount', v_failed_safe_count,
    'quarantinedCount', v_quarantined_count,
    'remainingDispatchableCount', v_remaining_count
  );
end;
$$;

create function public.begin_customer_project_token_rotation(
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_event_id uuid,
  p_expected_token_version integer
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.begin_customer_project_token_rotation(
    p_tenant_id,
    p_actor_uid,
    p_event_id,
    p_expected_token_version
  );
$$;

revoke all on function private.begin_customer_project_token_rotation(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.begin_customer_project_token_rotation(uuid, uuid, uuid, integer)
  to service_role;
revoke all on function public.begin_customer_project_token_rotation(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_customer_project_token_rotation(uuid, uuid, uuid, integer)
  to service_role;

create function private.store_customer_project_bearer_for_provisioning(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_next_token_version integer,
  p_kek_version integer,
  p_ciphertext text,
  p_iv text,
  p_fingerprint text,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_state text;
begin
  select provisioning_state
  into v_state
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and coalesce(bearer_token_version, 0) = p_expected_token_version
  for update;

  if not found
    or (
      p_expected_token_version = 0
      and v_state is distinct from 'registered'
    )
    or (
      p_expected_token_version > 0
      and v_state is distinct from 'rotation_gated'
    )
  then
    return false;
  end if;

  if not private.rotate_customer_project_bearer(
    p_tenant_id,
    p_expected_token_version,
    p_next_token_version,
    p_kek_version,
    p_ciphertext,
    p_iv,
    p_fingerprint
  ) then
    return false;
  end if;

  update public.customer_projects
  set
    provisioning_state = 'token_stored',
    updated_at = clock_timestamp()
  where id = p_tenant_id;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'rotate_token',
    'succeeded', null, null,
    jsonb_build_object('tokenVersion', p_next_token_version)
  );

  return true;
end;
$$;

create function public.store_customer_project_bearer_for_provisioning(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_next_token_version integer,
  p_kek_version integer,
  p_ciphertext text,
  p_iv text,
  p_fingerprint text,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.store_customer_project_bearer_for_provisioning(
    p_tenant_id,
    p_expected_token_version,
    p_next_token_version,
    p_kek_version,
    p_ciphertext,
    p_iv,
    p_fingerprint,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.store_customer_project_bearer_for_provisioning(
  uuid, integer, integer, integer, text, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.store_customer_project_bearer_for_provisioning(
  uuid, integer, integer, integer, text, text, text, uuid, uuid
) to service_role;
revoke all on function public.store_customer_project_bearer_for_provisioning(
  uuid, integer, integer, integer, text, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.store_customer_project_bearer_for_provisioning(
  uuid, integer, integer, integer, text, text, text, uuid, uuid
) to service_role;

create function private.activate_customer_project_for_provisioning(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_state text;
begin
  select provisioning_state
  into v_state
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_expected_token_version
  for update;

  if not found or v_state is distinct from 'token_stored' then
    return false;
  end if;

  if not private.activate_customer_project(
    p_tenant_id,
    p_expected_token_version
  ) then
    return false;
  end if;

  update public.customer_projects
  set
    provisioning_state = 'completed',
    updated_at = clock_timestamp()
  where id = p_tenant_id;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'activate_project',
    'succeeded', null, null,
    jsonb_build_object('tokenVersion', p_expected_token_version)
  );

  return true;
end;
$$;

create function public.activate_customer_project_for_provisioning(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.activate_customer_project_for_provisioning(
    p_tenant_id,
    p_expected_token_version,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.activate_customer_project_for_provisioning(
  uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.activate_customer_project_for_provisioning(
  uuid, integer, uuid, uuid
) to service_role;
revoke all on function public.activate_customer_project_for_provisioning(
  uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.activate_customer_project_for_provisioning(
  uuid, integer, uuid, uuid
) to service_role;

revoke all on function public.rotate_customer_project_bearer(
  uuid, integer, integer, integer, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.rotate_customer_project_bearer(
  uuid, integer, integer, integer, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.activate_customer_project(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.activate_customer_project(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.register_customer_project(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone
) from public, anon, authenticated, service_role;
revoke all on function private.register_customer_project(
  uuid, text, text, text, text, text, text, text, text,
  timestamp with time zone
) from public, anon, authenticated, service_role;

create or replace function private.claim_central_user_operation(
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

  perform 1
  from public.customer_projects
  where id = p_tenant_id
    and is_active = true
  for share;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'central_user_manager_project_inactive';
  end if;

  insert into public.user_management_operations (
    operation_id, tenant_id, actor_uid, action,
    target_email_normalized, request_hash
  )
  values (
    p_operation_id, p_tenant_id, p_actor_uid, p_action,
    p_target_email_normalized, p_request_hash
  )
  on conflict (operation_id) do nothing;

  if found then
    return jsonb_build_object('outcome', 'claimed', 'status', 'received');
  end if;

  select * into v_existing
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
      'agentStage', v_existing.agent_stage,
      'safeResult', v_existing.safe_result,
      'safeErrorCode', v_existing.safe_error_code
    );
  end if;

  raise exception using
    errcode = '23505',
    message = 'central_user_operation_id_conflict';
end;
$$;

notify pgrst, 'reload schema';
