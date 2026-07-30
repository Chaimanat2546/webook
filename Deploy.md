# Deploy

คู่มือสั้น ๆ สำหรับ deploy โปรเจกต์นี้บน Windows/PowerShell

## เช็กก่อน deploy

ใช้ `npm.cmd` แทน `npm` ถ้า PowerShell บล็อก `npm.ps1`.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test
```

ถ้ามี migration ของ Supabase ให้จัดการฐานข้อมูลก่อน deploy app. ห้ามใช้ `db reset` กับ production.

## Admin Web Worker

ตัว admin Next.js deploy ผ่าน OpenNext ไป Cloudflare Worker ชื่อ `webook-admin`.

Config ที่ใช้:

- `wrangler.jsonc`
- `open-next.config.ts`
- R2 incremental cache bucket: `webook-admin-next-cache`

ตั้ง secrets ใน Cloudflare ก่อน deploy:

```powershell
npx.cmd wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx.cmd wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_URL
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_SECRET
npx.cmd wrangler secret put AWS_REGION
npx.cmd wrangler secret put AWS_BUCKET
npx.cmd wrangler secret put AWS_ACCESS_KEY_ID
npx.cmd wrangler secret put AWS_SECRET_ACCESS_KEY
```

Preview local Cloudflare Worker:

```powershell
npm.cmd run preview:cf
```

Deploy จริง:

```powershell
npm.cmd run deploy:cf
```

### Central User Manager staging

`wrangler.jsonc` แยก staging เป็น Worker `webook-admin-staging` และ R2 bucket
`webook-admin-staging-next-cache` โดยไม่ใช้ Worker/cache ของ production.

ตั้ง runtime secrets ต่อไปนี้ด้วย `--env staging` โดยส่งค่าผ่าน stdin และห้าม
ใส่ค่า secret ใน command, Git หรือ log:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CENTRAL_USER_MANAGER_TOKEN_KEK`
- `CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION`

Build และ deploy:

```powershell
npx.cmd opennextjs-cloudflare build --env staging
npx.cmd opennextjs-cloudflare deploy --env staging
```

ตรวจ `/login`, ตรวจว่า admin API ปฏิเสธ request ที่ไม่มี session และรัน
authenticated Central User Manager health กับ `list_users` ก่อนถือว่า staging
พร้อมใช้งาน.

ถ้าต้อง upload version แต่ยังไม่ route traffic:

```powershell
npm.cmd run upload:cf
```

## Media Worker

ตัวนี้แยกจาก admin web app. ใช้สำหรับ upload/delete/serve รูปจาก R2.

Config ที่ใช้:

- `workers/media/wrangler.jsonc`
- Worker name: `webook-media`
- R2 bucket: `webook-media`

ตั้ง secret:

```powershell
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_SECRET --config workers/media/wrangler.jsonc
```

Deploy media Worker:

```powershell
npx.cmd wrangler deploy --config workers/media/wrangler.jsonc
```

## จำง่าย ๆ

- Deploy admin app ใช้ `npm.cmd run deploy:cf`
- Deploy media Worker ใช้ `npx.cmd wrangler deploy --config workers/media/wrangler.jsonc`
- อย่าใช้ `workers/media/wrangler.jsonc` deploy admin app
- อย่าใช้ root `wrangler.jsonc` deploy media Worker
