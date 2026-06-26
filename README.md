# VillaAdmin

Admin-only web app for managing pool villa images.

## Current focus

MVP 1: read-only admin image management.

Access is limited to Administrator users (`public.users.role_id = 1`).

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Cloudflare Workers

## Getting started

1. Copy `.env.example` to `.env.local`
2. Fill required environment variables
3. Run dev server

For local UI testing without a login session, set `ADMIN_AUTH_BYPASS=true` in `.env.local`.
The bypass is ignored when `NODE_ENV=production`.

## Scripts

Runtime Next.js scripts (`dev` and `start`) run through `node --use-system-ca` so server-side Supabase fetches trust the Windows system certificate store.

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
