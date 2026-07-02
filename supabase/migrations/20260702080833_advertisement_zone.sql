alter table public.advertisements
  add column zone text;

update public.advertisements
set zone = 'pattaya'
where zone is null;

alter table public.advertisements
  alter column zone set not null,
  add constraint advertisements_zone_check
    check (
      zone in (
        'bangkok',
        'bangsaray',
        'bang_saray',
        'bangsean',
        'bang_saen',
        'hua_hin',
        'huahin',
        'jomtien',
        'khaoyai',
        'pattaya',
        'rayong',
        'sattahip'
      )
    );

create index advertisements_zone_active_updated_idx
  on public.advertisements (zone, is_active desc, updated_at desc);
