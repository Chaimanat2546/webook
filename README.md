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

## Scripts

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
