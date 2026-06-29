# API Notes

## Advertisement Public Reads

External systems read active advertisements through Supabase Data API:

```text
advertisements?select=id,title,advertisement_images(image_name,image_order)&is_active=eq.true
```

The API returns `image_name` keys, not full image URLs. Build display URLs as:

```text
{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_name}
```
