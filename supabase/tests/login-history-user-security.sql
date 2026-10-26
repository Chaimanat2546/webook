begin;
set local role service_role;
select test.denied($q$select public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '{"name":"A","role_id":1}'::jsonb)$q$);
select test.denied($q$select public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',
 '{"name":"changed","role_id":1,"allow_tools":{}}'::jsonb)$q$);
select test.ok(public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
 '{"name":"B updated","role_id":2}'::jsonb) = '20000000-0000-4000-8000-000000000002', 'member manager can edit non-root');
select test.ok(public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',
 '{"name":"B root","role_id":1}'::jsonb) = '20000000-0000-4000-8000-000000000002', 'root can appoint root');
reset role;
-- Withdraw privileges between the initial web request and the DB write.
update public.users set allow_tools='{}' where uid='10000000-0000-4000-8000-000000000001';
set local role service_role;
select test.denied($q$select public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
 '{"name":"bad","role_id":2}'::jsonb)$q$);
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';
select test.denied($q$update public.users set role_id=1 where uid=auth.uid()$q$);
select test.denied($q$update public.users set uid='10000000-0000-4000-8000-000000000003' where uid=auth.uid()$q$);
select test.denied($q$select public.webook_update_user_guarded(
 '10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',
 '{"name":"bad","role_id":1}'::jsonb)$q$);
reset role;
-- A SECURITY DEFINER legacy path must not circumvent the direct-write guard.
create function test.legacy_escalate() returns void language sql security definer as $$
 update public.users set role_id=1 where uid=auth.uid()
$$;
set local role authenticated;
select test.denied('select test.legacy_escalate()');
reset role;
rollback;
