create function private.rewrap_customer_project_bearer_kek(
  p_tenant_id uuid,
  p_token_version integer,
  p_expected_kek_version integer,
  p_expected_ciphertext text,
  p_expected_iv text,
  p_fingerprint text,
  p_next_kek_version integer,
  p_next_ciphertext text,
  p_next_iv text,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_next_kek_version <= p_expected_kek_version then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_kek_version_must_increment';
  end if;

  update public.customer_projects
  set
    bearer_token_ciphertext = p_next_ciphertext,
    bearer_token_iv = p_next_iv,
    bearer_token_kek_version = p_next_kek_version,
    updated_at = clock_timestamp()
  where id = p_tenant_id
    and bearer_token_version = p_token_version
    and bearer_token_kek_version = p_expected_kek_version
    and bearer_token_ciphertext = p_expected_ciphertext
    and bearer_token_iv = p_expected_iv
    and bearer_token_fingerprint = p_fingerprint;

  if not found then
    return false;
  end if;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'rotate_kek',
    'succeeded', null, null,
    jsonb_build_object(
      'status', 'kek_rewrapped',
      'tokenVersion', p_token_version
    )
  );

  return true;
end;
$$;

create function public.rewrap_customer_project_bearer_kek(
  p_tenant_id uuid,
  p_token_version integer,
  p_expected_kek_version integer,
  p_expected_ciphertext text,
  p_expected_iv text,
  p_fingerprint text,
  p_next_kek_version integer,
  p_next_ciphertext text,
  p_next_iv text,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.rewrap_customer_project_bearer_kek(
    p_tenant_id,
    p_token_version,
    p_expected_kek_version,
    p_expected_ciphertext,
    p_expected_iv,
    p_fingerprint,
    p_next_kek_version,
    p_next_ciphertext,
    p_next_iv,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.rewrap_customer_project_bearer_kek(
  uuid, integer, integer, text, text, text, integer, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function private.rewrap_customer_project_bearer_kek(
  uuid, integer, integer, text, text, text, integer, text, text, uuid, uuid
) to service_role;
revoke all on function public.rewrap_customer_project_bearer_kek(
  uuid, integer, integer, text, text, text, integer, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.rewrap_customer_project_bearer_kek(
  uuid, integer, integer, text, text, text, integer, text, text, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';
