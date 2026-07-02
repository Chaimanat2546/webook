alter table public.advertisements
  drop constraint advertisements_zone_check;

alter table public.advertisements
  add constraint advertisements_zone_check
    check (
      zone in (
        'all',
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
