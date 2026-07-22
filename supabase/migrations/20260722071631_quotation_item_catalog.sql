create table public.quotation_item_catalog (
  name text primary key,
  sort_order smallint not null unique check (sort_order > 0)
);

insert into public.quotation_item_catalog (name, sort_order) values
  ('ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)', 1),
  ('ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)', 2),
  ('ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)', 3),
  ('ค่าบริการ', 4),
  ('ประกันความเสียหาย', 5);

alter table public.quotation_item_catalog enable row level security;
revoke all privileges on table public.quotation_item_catalog from anon, authenticated;
grant select on table public.quotation_item_catalog to authenticated;

create policy "Quotation users read item catalogue"
  on public.quotation_item_catalog for select to authenticated
  using ((select private.has_quotation_permission()));

alter table public.quotation_items
  add constraint quotation_items_name_catalog_fk
  foreign key (name) references public.quotation_item_catalog(name)
  on update restrict on delete restrict not valid;
