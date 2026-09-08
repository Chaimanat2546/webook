create or replace view public.review_booking_verifications
with (security_invoker = true)
as
select
  b.booking_code,
  c.phone,
  l.property_id
from public.bookings b
join public.customers c on c.id = b.customer_id
join public.listings l on l.id = b.listing_id
where b.booking_code is not null
  and c.phone is not null;

revoke all on table public.review_booking_verifications from anon, authenticated;
grant select on table public.review_booking_verifications to service_role;

notify pgrst, 'reload schema';
