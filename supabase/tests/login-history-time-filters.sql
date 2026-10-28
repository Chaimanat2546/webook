begin;
insert into public.login_history(user_id,session_id,logged_in_at,location_status)
select '10000000-0000-4000-8000-000000000001',gen_random_uuid(),stamp::timestamptz,
  case when n=5 then 'denied' else 'pending' end
from unnest(array[
  '2026-10-28 08:59:59.999999+07','2026-10-28 09:00:00+07',
  '2026-10-28 17:59:59.999999+07','2026-10-28 18:00:00+07',
  '2026-10-29 09:00:00+07','2026-10-29 18:00:00+07',
  '2026-10-29 23:59:59.999999+07','2026-10-30 00:00:00+07',
  '2026-10-28 00:00:00+07'
]) with ordinality t(stamp,n);
set local role service_role;
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,25)->>'total')::int=8,'legacy callers retain full days');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,2,null,'oldest',9,18)->>'total')::int=3,'daily Bangkok window counts before pagination');
select test.ok(jsonb_array_length(public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',2,2,null,'oldest',9,18)->'entries')=1,'window applied before second page');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,25,'denied','oldest',9,18)->>'total')::int=1,'status combines with daily hours');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,25,null,'oldest',0,1)->>'total')::int=1,'Bangkok midnight is included');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,25,null,'latest',23,24)->>'total')::int=1,'24:00 includes fractional last second but excludes next day');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-30 00:00+07',1,1,null,'oldest',9,18)->'entries'->0->>'logged_in_at')::timestamptz='2026-10-28 09:00+07'::timestamptz,'inclusive start sorts first');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','','2026-10-28 00:00+07','2026-10-29 00:00+07',1,25,null,'latest',9,18)->>'total')::int=2,'single day includes microseconds below exclusive end');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,null,'latest',18,9)$q$,'22023');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,null,'latest',null,24)$q$,'22023');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,null,'latest',0,25)$q$,'22023');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000001','',null,null,1,25,null,'latest',9,18)$q$,'42501');
set local role authenticated;
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,null,'latest',9,18)$q$,'42501');
reset role;
rollback;
