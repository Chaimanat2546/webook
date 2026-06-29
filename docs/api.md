# API Notes

## Advertisement Public Reads

External systems read active advertisements through Supabase Data API:

```text
advertisements?select=id,title,advertisement_images(image_name,image_order)&is_active=eq.true
```

The API returns filename-only `image_name` values, not full image URLs. Build display URLs by composing the Worker object key from the parent advertisement id:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/advertisements/{advertisement_id}/{image_name}
```

Example `image_name` format for newly uploaded images:

```text
20260109220657_60b5a9a545.webp
```
