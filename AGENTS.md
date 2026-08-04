## Project Overview

This system manages accommodation data, seller websites, and operational
workflows for a multi-seller accommodation business. Each seller has its own
website and data scope.

## Goals

- Clean Architecture
- Reusable Components
- Strong Type Safety
- Easy Maintenance
- Mobile First

## Tech Stack

- **Framework:** Next.js App Router, React, TypeScript
- **Styling & UI:** Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons
- **Backend & Database:** Supabase (PostgreSQL, Auth, Storage, and Edge Functions where applicable)
- **Deployment:** Cloudflare Workers through OpenNext
- **PDF & Payments:** React PDF Renderer, QR Code, Thai QR Payment
- **Testing:** Node.js Test Runner
- **Code Quality:** ESLint and TypeScript
- **Package Manager:** npm

## Architecture

Use Clean Architecture and keep UI, business logic, data access, and external
integrations separate.

```text
app/ (routes, Server Components, Server Actions)
  -> server/services/ (business use cases)
  -> server/repositories/ or server/storage/ (data and media access)
  -> Supabase / Cloudflare R2 / approved external APIs
```

- `app/` contains routes, Server Components, and Server Actions.
- `components/ui/` contains reusable UI primitives; `components/layout/` contains shared application layout; `components/admin/` contains reusable feature components.
- `server/auth/` contains server-side authentication and authorization.
- `server/services/` contains business rules and orchestration.
- `server/repositories/` contains Supabase queries and RPC calls only.
- `server/storage/` contains media storage adapters.
- `server/central-user-manager/` contains allowlisted multi-tenant Cloudflare Worker service integrations.
- `lib/` contains shared, framework-light utilities, types, validation, and calculations. Server-only code belongs in `server/`.
- `supabase/migrations/` is the source of truth for schema and RLS changes. Never edit an existing migration.
- Client components must never access privileged Supabase clients, secrets, or storage credentials.
- Server Actions validate input and authorize the request before calling services.
- Multi-tenant targets and Cloudflare Worker bindings must be explicitly allowlisted; never accept arbitrary tenant endpoints or bindings from the client.
- The Media Worker is separate from the admin web Worker. Media access must use approved key prefixes and the server-side storage adapters.

## Deployment Rules

| Environment | Supabase Project URL | Cloudflare Account ID |
| --- | --- | --- |
| Production | `https://rqizfiayvcbozlzuvbok.supabase.co` | `7c1d945e149fc6fad2124176124d8f33` |
| Staging | `https://sxvkhzhqtrpxgzumsswl.supabase.co` | `0df55f166fa309dcc904e992c43f86db` |

- Agents may deploy only to **Staging** when deployment is required by the task.
- Deploying to **Production** is prohibited unless the user gives a direct, explicit instruction in the current chat, such as “deploy to production”.
- Before any Production deployment, state the exact Supabase project URL and Cloudflare account ID that will be targeted, then wait for confirmation.
- Never infer Production deployment permission from requests to finish, publish, release, test, or deploy in general.
- Before deploying, verify the selected environment and its target configuration. Do not deploy when the target is ambiguous or does not match the table above.

## Code Style

Always:

- Use TypeScript strict mode.
- Never use `any`; use explicit types or `unknown` with narrowing.
- Prefer `interface` for object-shaped contracts.
- Prefer `async`/`await` over promise chaining.
- Keep components small and focused.
- Prefer composition over large monolithic components.

## Component Reuse

- Before creating a UI component, search existing project components and installed libraries first.
- Prefer reusing `components/ui/`, shared project components, and installed library components over creating a custom equivalent.
- When suitable component options are found, present the options and recommended choice to the user before implementation.
- Do not introduce a dependency or install a component library without explicit user approval.
- Create a custom component only when no existing option satisfies the required behavior, design, accessibility, or maintainability needs.

## Workflow

Follow this sequence for feature work and meaningful changes:

1. **Requirements** — Understand what the user needs.
2. **Design** — Propose the screen or interaction when UI/UX changes.
3. **Architecture** — Identify the files, data, and integrations that need to change.
4. **Implementation** — Write or change the code.
5. **Review** — Check that the code meets the requirements and standards.
6. **Testing** — Run relevant checks and tests.
7. **Documentation** — Update documentation when behavior, architecture, API, configuration, or workflow changes.

Very small changes, such as typo, copy-only, or obvious one-line changes, may skip Design and Architecture.

## Security

Never expose:

- API keys
- Supabase service-role keys
- Sensitive environment-variable values
- Secrets, tokens, passwords, or private credentials

- Read sensitive environment variables only in server-side code.
- Never send secrets to client components, browser code, logs, error messages, commits, or documentation.
- Validate all external input before use.
- Use least-privilege access and enforce authorization on the server.

## Definition of Done

A feature is complete only when:

- [ ] Build passes
- [ ] Type check passes
- [ ] Relevant tests pass
- [ ] Documentation is updated when behavior, architecture, API, configuration, or workflow changes
- [ ] Code has been reviewed

For changes that do not affect code or system behavior, build and test checks may
be skipped only when the reason is stated clearly.
