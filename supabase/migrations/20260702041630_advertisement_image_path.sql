alter table public.advertisement_images
  add column image_path text generated always as (
    case
      when image_name like 'advertisements/%' then image_name
      else 'advertisements/' || advertisement_id::text || '/' || image_name
    end
  ) stored;
