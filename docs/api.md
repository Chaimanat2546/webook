# API Notes

## Advertisement Public Reads

External systems read active advertisements through Supabase Data API:

```text
advertisements?select=id,title,advertisement_images(image_name,image_path,image_order)&is_active=eq.true
```

The API returns `image_path` object keys, not full image URLs. Build display URLs by appending `image_path` to the Worker URL:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_path}
```

Example values for newly uploaded images:

```text
image_name: 20260109220657_60b5a9a545.webp
image_path: advertisements/{advertisement_id}/20260109220657_60b5a9a545.webp
```
