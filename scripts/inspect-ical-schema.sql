-- Read-only structural inspection; no booking/customer data is returned.
begin read only;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('bookings', 'listings', 'booking_logs')
order by table_name, ordinal_position;
select c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c where c.conrelid in ('public.bookings'::regclass, 'public.listings'::regclass);
select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'bookings';
select t.tgname, pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
from pg_trigger t where t.tgrelid = 'public.bookings'::regclass and not t.tgisinternal;
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
('admin_create_house_booking', 'admin_update_house_booking', 'dashboard_report');
commit;
