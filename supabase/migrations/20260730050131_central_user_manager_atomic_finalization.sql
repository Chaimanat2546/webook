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
        or (
          v_normalized_key like '%credential%'
          and v_normalized_key not in (
            'credentialversion',
            'authcredentialversion'
          )
        )
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

alter table public.user_management_operations
  add column agent_stage text;

alter table public.user_management_operations
  add constraint user_management_operations_agent_stage check (
    agent_stage is null
    or agent_stage in (
      'list',
      'listed',
      'claimed',
      'completed',
      'needs_review',
      'quarantined',
      'late_fence',
      'provider_intent',
      'provider_outcome',
      'profile_created',
      'compensation_ready',
      'profile_advanced',
      'profile_activated',
      'auth_create_intent',
      'auth_create_succeeded',
      'auth_create_rejected',
      'auth_delete_intent',
      'auth_delete_succeeded',
      'auth_delete_rejected',
      'auth_update_intent',
      'auth_update_succeeded',
      'auth_update_rejected',
      'password_verify_intent',
      'password_verify_succeeded',
      'password_verify_rejected',
      'global_signout_intent',
      'global_signout_succeeded',
      'global_signout_rejected'
    )
  );

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

revoke all on function public.complete_central_user_operation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
drop function public.complete_central_user_operation(uuid, text, jsonb);
revoke all on function private.complete_central_user_operation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
drop function private.complete_central_user_operation(uuid, text, jsonb);

revoke all on function public.mark_central_user_operation_ambiguous(uuid, text, text, text)
  from public, anon, authenticated, service_role;
drop function public.mark_central_user_operation_ambiguous(uuid, text, text, text);
revoke all on function private.mark_central_user_operation_ambiguous(uuid, text, text, text)
  from public, anon, authenticated, service_role;
drop function private.mark_central_user_operation_ambiguous(uuid, text, text, text);

revoke all on function public.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
drop function public.reconcile_central_user_operation(uuid, text, text, text, jsonb, text);
revoke all on function private.reconcile_central_user_operation(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
drop function private.reconcile_central_user_operation(uuid, text, text, text, jsonb, text);

create function private.finalize_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_expected_status text,
  p_next_status text,
  p_agent_stage text,
  p_safe_result jsonb,
  p_safe_error_code text,
  p_event_id uuid,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_operation public.user_management_operations%rowtype;
  v_metadata jsonb;
begin
  perform private.require_central_user_service_role();

  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'central_user_operation_invalid_finalization';
  end if;

  if not (
    (
      p_expected_status = 'dispatching'
      and p_next_status in (
        'completed',
        'failed_safe',
        'in_progress',
        'needs_review',
        'quarantined'
      )
    )
    or
    (
      p_expected_status in ('in_progress', 'needs_review', 'quarantined')
      and p_next_status in ('completed', 'failed_safe', 'quarantined')
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'central_user_operation_invalid_finalization';
  end if;

  if not (
    (
      p_next_status = 'completed'
      and p_safe_result is not null
      and p_agent_stage is not null
      and (
        p_safe_error_code is null
        or p_safe_error_code = 'operation_conflict'
      )
    )
    or
    (
      p_next_status = 'failed_safe'
      and p_safe_result is null
      and p_safe_error_code is not null
    )
    or
    (
      p_next_status in ('in_progress', 'needs_review', 'quarantined')
      and p_safe_result is null
      and p_safe_error_code is not null
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'central_user_operation_invalid_finalization';
  end if;

  update public.user_management_operations
  set
    status = p_next_status,
    agent_stage = p_agent_stage,
    safe_result = p_safe_result,
    safe_error_code = p_safe_error_code,
    completed_at = case
      when p_next_status in ('completed', 'failed_safe')
        then clock_timestamp()
      else null
    end,
    updated_at = clock_timestamp()
  where operation_id = p_operation_id
    and request_hash = p_request_hash
    and status = p_expected_status
  returning *
  into v_operation;

  if not found then
    return false;
  end if;

  v_metadata := p_metadata;
  if p_agent_stage is not null then
    v_metadata := coalesce(v_metadata, '{}'::jsonb)
      || jsonb_build_object('stage', p_agent_stage);
  end if;

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
    v_operation.operation_id,
    v_operation.tenant_id,
    v_operation.actor_uid,
    v_operation.action,
    p_next_status,
    p_safe_error_code,
    v_operation.request_hash,
    v_metadata
  );

  return true;
end;
$$;

create function public.finalize_central_user_operation(
  p_operation_id uuid,
  p_request_hash text,
  p_expected_status text,
  p_next_status text,
  p_agent_stage text,
  p_safe_result jsonb,
  p_safe_error_code text,
  p_event_id uuid,
  p_metadata jsonb
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.finalize_central_user_operation(
    p_operation_id,
    p_request_hash,
    p_expected_status,
    p_next_status,
    p_agent_stage,
    p_safe_result,
    p_safe_error_code,
    p_event_id,
    p_metadata
  );
$$;

revoke all on function private.finalize_central_user_operation(uuid, text, text, text, text, jsonb, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.finalize_central_user_operation(uuid, text, text, text, text, jsonb, text, uuid, jsonb)
  to service_role;
revoke all on function public.finalize_central_user_operation(uuid, text, text, text, text, jsonb, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_central_user_operation(uuid, text, text, text, text, jsonb, text, uuid, jsonb)
  to service_role;

notify pgrst, 'reload schema';
