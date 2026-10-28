begin;
insert into public.login_history(user_id,session_id,logged_in_at,location_status,latitude,longitude,accuracy_m,location_captured_at,location_received_at)
select '10000000-0000-4000-8000-000000000001',gen_random_uuid(),now()-n*interval '1 minute',status,
  case when status='success' then 0 end,case when status='success' then 0 end,
  case when status='success' then 25 end,case when status='success' then now() end,case when status='success' then now() end
from unnest(array['pending','success','skipped','denied','unavailable','timeout','unsupported']) with ordinality t(status,n);
set local role service_role;
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000001','',null,null,1,25)$q$,'42501');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,'bad','latest')$q$,'22023');
select test.denied($q$select public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,25,null,'bad')$q$,'22023');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,2)->>'total')::int=7,'total before pagination');
select test.ok(jsonb_array_length(public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,2,2)->'entries')=2,'second page');
select test.ok(public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,2,null,'latest')->'entries'->0->>'location_status'='pending','latest first');
select test.ok(public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,2,null,'oldest')->'entries'->0->>'location_status'='unsupported','oldest first');
select test.ok((public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,1,status,'oldest')->>'total')::int=1,'each status filters full dataset')
from unnest(array['pending','success','skipped','denied','unavailable','timeout','unsupported']) t(status);
reset role;
-- Identical times still have a deterministic UUID order in both directions.
update public.login_history set logged_in_at='2026-10-28T00:00:00Z';
set local role service_role;
select test.ok(
  public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,1,null,'oldest')->'entries'->0->>'id'
  = (select min(id::text) from public.login_history),'ascending UUID tie');
select test.ok(
  public.login_history_list('10000000-0000-4000-8000-000000000003','',null,null,1,1,null,'latest')->'entries'->0->>'id'
  = (select max(id::text) from public.login_history),'descending UUID tie');
reset role;
rollback;
