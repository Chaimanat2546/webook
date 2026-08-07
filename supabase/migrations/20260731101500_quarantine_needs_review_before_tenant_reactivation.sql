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

  if p_tenant_id is null then
    raise exception using
      errcode = '22004',
      message = 'central_user_manager_tenant_id_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  perform 1
  from public.customer_projects
  where id = p_tenant_id
    and is_active = true
    and provisioning_state = 'completed'
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

create or replace function private.begin_customer_project_reactivation(
  p_tenant_id uuid,
  p_attempt_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project public.customer_projects%rowtype;
  v_operation public.user_management_operations%rowtype;
  v_pending_count integer;
  v_now timestamp with time zone := clock_timestamp();
  v_outcome text;
  v_can_begin boolean := false;
begin
  perform private.require_central_user_service_role();

  if p_tenant_id is null
    or p_attempt_id is null
    or p_expected_token_version is null
    or p_expected_token_version < 1
    or p_actor_uid is null
    or p_event_id is null
    or not exists (
      select 1
      from public.users
      where uid = p_actor_uid
        and role_id = 1
    )
  then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_expected_token_version
  for update;

  if not found then
    return null;
  end if;

  if v_project.provisioning_state = 'reactivation_verifying'
    and v_project.reactivation_attempt_id = p_attempt_id
    and v_project.reactivation_started_at is not null
  then
    v_outcome := 'retry';
    v_can_begin := true;
  elsif v_project.provisioning_state = 'reactivation_verifying'
    and v_project.reactivation_started_at >= v_now - interval '5 minutes'
  then
    v_outcome := 'conflict';
    v_can_begin := true;
  elsif (
      v_project.provisioning_state = 'reactivation_verifying'
      and v_project.reactivation_started_at < v_now - interval '5 minutes'
    )
    or (
      v_project.provisioning_state = 'completed'
      and v_project.last_verified_token_version is null
      and (
        v_project.last_health_status = 'unhealthy'
        or (
          v_project.last_health_status = 'healthy'
          and v_project.last_safe_error_code is not null
        )
      )
    )
  then
    v_outcome := 'received';
    v_can_begin := true;
  end if;

  if not v_can_begin then
    return null;
  end if;

  if v_outcome <> 'conflict' then
    select count(*)
    into v_pending_count
    from public.user_management_operations
    where tenant_id = p_tenant_id
      and status in ('received', 'dispatching', 'in_progress');

    if v_pending_count <> 0 then
      return null;
    end if;

    for v_operation in
      update public.user_management_operations
      set
        status = 'quarantined',
        safe_result = null,
        safe_error_code = 'operation_ambiguous',
        completed_at = null,
        updated_at = v_now
      where tenant_id = p_tenant_id
        and status = 'needs_review'
      returning *
    loop
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
        gen_random_uuid(),
        v_operation.operation_id,
        p_tenant_id,
        p_actor_uid,
        v_operation.action,
        'quarantined',
        'operation_ambiguous',
        v_operation.request_hash,
        jsonb_build_object('status', 'reactivation_gate')
      );
    end loop;

    select count(*)
    into v_pending_count
    from public.user_management_operations
    where tenant_id = p_tenant_id
      and status in ('received', 'dispatching', 'in_progress', 'needs_review');

    if v_pending_count <> 0 then
      raise exception using
        errcode = '40001',
        message = 'central_user_manager_reactivation_invariant_failed';
    end if;

    if v_outcome = 'received' then
      update public.customer_projects
      set
        provisioning_state = 'reactivation_verifying',
        reactivation_attempt_id = p_attempt_id,
        reactivation_started_at = v_now,
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
        last_safe_error_code = null,
        updated_at = v_now
      where id = p_tenant_id
      returning * into strict v_project;
    end if;
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
    null,
    p_tenant_id,
    p_actor_uid,
    'verify_project',
    v_outcome,
    case when v_outcome = 'conflict' then 'operation_conflict' else null end,
    null,
    jsonb_build_object(
      'status', 'reactivation_verifying',
      'tokenVersion', p_expected_token_version
    )
  );

  if v_outcome = 'conflict' then
    return jsonb_build_object('outcome', v_outcome);
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'attemptId', v_project.reactivation_attempt_id,
    'tokenVersion', v_project.bearer_token_version
  );
end;
$$;

revoke all on function private.claim_central_user_operation(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.claim_central_user_operation(
  uuid, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';
