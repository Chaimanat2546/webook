begin;
set local role service_role;
select public.login_history_record(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 now()-interval '1 minute','127.0.0.1','Linux','Chrome','desktop');
select public.login_history_record(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 now(),'192.0.2.1','changed','changed','mobile');
select test.ok((select count(*)=1 and min(ip_address::text)='127.0.0.1/32' and min(os)='Linux'
 from public.login_history where user_id='10000000-0000-4000-8000-000000000001'), 'duplicate does not overwrite');
select public.login_history_record(
 '10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',
 now()-interval '1 minute',null,'unknown','unknown','unknown');
select test.denied($q$select public.login_history_attach(
 '10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000001'),
 'skipped',null,null,null,null)$q$, 'P0002');
select public.login_history_attach(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000001'),
 'success',0,0,0,now());
select public.login_history_attach(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000001'),
 'success',0,0,0,now());
select test.denied($q$select public.login_history_attach(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000001'),
 'skipped',null,null,null,null)$q$, 'P0001');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role='authenticated';
select test.ok((select count(*)=0 from public.login_history), 'non-root cannot read even own rows');
select test.denied('update public.login_history set latitude=1');
select test.denied('delete from public.login_history');
select test.denied('truncate public.login_history');
select test.denied($q$select public.login_history_purge()$q$);
select test.denied($q$select public.login_history_attach(null,null,null,'skipped',null,null,null,null)$q$);
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select test.ok((select count(*)=2 from public.login_history), 'root reads local history');
reset role;
set local role anon;
select test.denied('select * from public.login_history');
reset role;
-- Constraints at the actual DB boundary, including NaN and Infinity.
select test.denied($q$update public.login_history set latitude='NaN' where location_status='success'$q$, '23514');
select test.denied($q$update public.login_history set accuracy_m='Infinity' where location_status='success'$q$, '23514');
select test.denied($q$update public.login_history set longitude=181 where location_status='success'$q$, '23514');
select test.denied($q$update public.login_history set location_status='denied' where location_status='success'$q$, '23514');
delete from auth.sessions where user_id='10000000-0000-4000-8000-000000000001';
select test.ok((select count(*)=1 from public.login_history where user_id='10000000-0000-4000-8000-000000000001'), 'logout preserves history');
set local role service_role;
select test.denied($q$select public.login_history_attach(
 '10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000001'),
 'success',0,0,0,now())$q$, '28000');
reset role;
update public.login_history set logged_in_at=now()-interval '11 minutes' where user_id='10000000-0000-4000-8000-000000000002';
set local role service_role;
select test.denied($q$select public.login_history_attach(
 '10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',
 (select id from public.login_history where user_id='10000000-0000-4000-8000-000000000002'),
 'skipped',null,null,null,null)$q$, 'P0001');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000001','B',null,null,1,25)$q$);
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25)->>'total')::int=2, 'root list total');
select test.ok(not ((public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25)->'entries'->0) ? 'session_id'), 'list DTO omits session id');
reset role;
insert into public.login_history(user_id,session_id,logged_in_at) select
 '10000000-0000-4000-8000-000000000001',gen_random_uuid(),now()-interval '91 days' from generate_series(1,1001);
insert into public.login_history(user_id,session_id,logged_in_at) values
 ('10000000-0000-4000-8000-000000000001',gen_random_uuid(),now()-interval '90 days');
set local role service_role;
select test.ok(public.login_history_purge()=1000, 'bounded purge');
select test.ok(public.login_history_purge()=1, 'next purge drains backlog');
select test.ok(public.login_history_purge()=0, 'cutoff is exclusive and retry is safe');
reset role;
set local request.jwt.claim.role='';
delete from auth.users where id='10000000-0000-4000-8000-000000000001';
select test.ok((select count(*)=0 from public.login_history where user_id='10000000-0000-4000-8000-000000000001'), 'account deletion removes history');
insert into public.login_history(user_id,session_id,logged_in_at) values
 ('10000000-0000-4000-8000-000000000002',gen_random_uuid(),'2026-10-25T16:59:59Z'),
 ('10000000-0000-4000-8000-000000000002',gen_random_uuid(),'2026-10-25T17:00:00Z'),
 ('10000000-0000-4000-8000-000000000002',gen_random_uuid(),'2026-10-26T16:59:59Z'),
 ('10000000-0000-4000-8000-000000000002',gen_random_uuid(),'2026-10-26T17:00:00Z');
-- Exclude the earlier live-time row with a known profile search, then check
-- the exact timezone boundaries without depending on the host's current day.
delete from public.login_history where user_id='10000000-0000-4000-8000-000000000002' and session_id='30000000-0000-4000-8000-000000000002';
set local role service_role;
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','B','2026-10-25T17:00:00Z','2026-10-26T17:00:00Z',1,25)->>'total')::int=2, 'Bangkok date boundaries are inclusive/exclusive');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','%',null,null,1,25)->>'total')::int=0, 'search text is literal, not a filter expression');
reset role;
rollback;
