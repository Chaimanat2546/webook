-- Minimal, isolated PostgreSQL fixture. Mirrors the relevant public.users
-- column types from 20260626050000_remote_public_schema.sql, not a remote dump.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table auth.sessions (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
create table public.roles (id smallint primary key, name json);
create table public.users (
  id uuid primary key default gen_random_uuid(), uid uuid references auth.users(id) on delete cascade,
  name varchar, username varchar, email varchar, role_id smallint default 3 references public.roles(id),
  allow_tools jsonb, dv_id bigint, mid bigint, updated_at timestamptz default now()
);
grant all on public.users, public.roles to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.sessions to service_role;
create schema test;
grant usage on schema test to anon, authenticated, service_role;
create function test.ok(condition boolean, label text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if;
end;
$$;
create function test.denied(statement text, expected text default '42501') returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Unexpected SQLSTATE %, expected %', sqlstate, expected;
  end;
  raise exception 'Statement unexpectedly succeeded';
end;
$$;
insert into public.roles values (1, '"Root"'), (2, '"Staff"');
insert into auth.users values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003');
insert into public.users(id,uid,name,username,email,role_id,allow_tools) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','A','a','a@example.test',2,'{"allow_members":true}'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','B','b','b@example.test',2,'{}'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Root','root','root@example.test',1,'{"allow_members":true}');
insert into auth.sessions values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
