## Project overview

This is an admin-only web application for managing pool villa data and pool villa images.

The current development focus is the house image management feature. Do not expand the scope into full house data management, public villa listing pages, SEO, booking, payment, or customer-facing features unless explicitly requested.

Critical flows:
- Admin authentication
- Protected admin access
- House image listing
- House image upload/import
- House image deletion
- External image URL validation
- Storage/API error handling

Out of scope for the current feature:

- Public-facing villa listing pages
- Booking or calendar management
- Payment flows
- SEO and marketing pages
- Full house data CRUD, unless required to support image management

## Tech stack
- Frontend: Next.js App Router, React, TypeScript
- Styling: Tailwind with ShadcnUI
- Backend: Supabase Backend-as-a-Service
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Authorization: Supabase Row Level Security (RLS)
- Image storage: External image APIs / cloud storage, depending on the feature
- Admin logic: Next.js Route Handlers and server-side modules
- Package manager: npm
- Testing: Vitest / Playwright
- Deployment: not configured for the Next.js admin app in this repo; Cloudflare is only used for media Worker/R2 image storage

## Commands

The user manages dependency installation manually.

Agents must NOT run commands that install, remove, upgrade, or modify dependencies, including:

- `npm install`
- `yarn install`
- `bun install`
- `npm install <package>`
- `npm add <package>`
- `npm remove <package>`
- `npm uninstall <package>`
- `npx shadcn@latest add ...` when it would install or modify npm dependencies
- any command that modifies `package.json` or lockfiles without explicit user approval

If a new dependency is required, or if adding one would clearly improve maintainability, reuse, security, performance, correctness, or developer experience:

1. First check whether existing project dependencies already cover the need.
2. If a new dependency is the better path, explain why and what tradeoff it avoids.
3. Provide the exact install command for the user to run, or request explicit approval before running it.
4. Do not run the install command yourself without explicit approval.

ShadcnUI components are treated as approved reusable source components, not new product scope.

- Prefer importing existing `components/ui/*` shadcn components before writing custom UI primitives.
- If a needed shadcn component is missing, agents may add it with `npx shadcn@latest add <component>` after checking existing components first.
- Do not run broad shadcn commands such as `add --all`, `init`, preset changes, reinstall, or overwrite without explicit user approval.
- If shadcn would add or change npm dependencies, `package.json`, or lockfiles, ask first and explain why.
- After adding a shadcn component, read the generated files and fix imports/composition to match this project.

Allowed verification commands:

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`

## Project structure

- `app/login/` contains the admin login page.
- `app/admin/` contains protected admin pages.
- `app/api/` contains API route handlers used by the admin UI.
- `components/ui/` contains reusable low-level UI components.
- `components/layout/` contains admin layout components such as sidebar, navbar, and page headers.
- `server/` contains server-only logic such as auth checks, repositories, storage adapters, and admin services.
- `lib/` contains shared utilities, environment helpers, and validators.
- `tests/` contains automated tests.

## Architecture rules

- Admin pages must not access Supabase directly from client components unless there is a clear reason.
- Server-side data access should go through `server/` modules.
- Route handlers in `app/api/` should validate input and call server services.
- Keep storage/image provider logic behind adapter modules.
- Prefer existing patterns before creating new abstractions.
- Make implementation decisions with maintainability, reuse, security, and performance in mind.
- Before implementing or changing UI flow/structure, ask whether the user already has a design or flow. Confirm the flow step by step before building it.
- Do not build an entire UI flow in one pass unless the user has already approved the structure.
- UI must be designed mobile-first and verified across mobile, tablet, laptop, and desktop layouts.

## Coding conventions

- Use TypeScript strict mode.
- Avoid `any`; use proper types or `unknown` with narrowing.
- Use functional React components.
- Keep components small and focused.
- Prefer named exports for shared modules.
- Do not introduce new dependencies without explaining why.
- Prefer shadcn/ui primitives over hand-written common UI controls when an existing or addable shadcn component fits.
- Follow existing naming and folder conventions.

## Testing expectations

- If changing business logic, add or update unit tests.
- If changing API behavior, update API tests.
- If changing UI flow, update component or e2e tests where relevant.
- If fixing a bug, add a regression test when practical.
- Before finishing, run:
  - `npm typecheck`
  - `npm lint`
  - `npm test`

## Database rules

- Do not edit existing migrations.
- Create a new migration for schema changes.
- Do not drop columns or tables without explicit instruction.
- Do not reset production-like databases.
- Use seed data only in development or test environments.
- Keep Supabase migrations, generated database types, RLS policies, and tests in sync.

## Security rules

- Never commit secrets, API keys, tokens, passwords, or private credentials.
- Never log access tokens, refresh tokens, passwords, or full authorization headers.
- Read environment variables from server-side code only.
- Validate external input before using it.
- Do not expose private user data to client components.
- Do not create arbitrary image proxy endpoints.
- Validate image URLs and allowed domains before fetching or storing external images.
- Do not expose private storage credentials to client-side code.

## Documentation maintenance

Agents should keep project documentation up to date when a task changes project behavior, feature scope, architecture, API contracts, environment variables, or important setup steps.

Important documentation files:

- README.md - human-facing project overview, setup instructions, scripts, and current development focus
- docs/image-management.md - requirement, scope, behavior, validation, edge cases, and testing checklist for the house image management feature
- docs/architecture.md - system structure, data flow, boundaries, and major technical decisions
- .env.example - required environment variables without real secrets
- docs/api.md or feature-specific API docs - API routes, request/response shape, validation, and error behavior, if such files exist

When to update documentation:

- A feature requirement changes
- A new admin flow is added
- API behavior changes
- Data model, database fields, storage behavior, or RLS behavior changes
- Environment variables are added, renamed, or removed
- Setup, build, test, or deployment steps change
- Error handling or security behavior changes
- The implementation differs from the existing documentation

Documentation rules:

- Do not update documentation for unrelated changes.
- Do not invent requirements that were not requested.
- If a detail is uncertain, add it under an Open questions section instead of guessing.
- Keep documentation short, practical, and useful for future coding agents.
- Prefer updating existing documentation over creating new files.
- If a new documentation file is needed, explain why before creating it.
- Documentation changes should match the actual code changes.

Before finishing a task, the agent should mention whether documentation was updated.

If documentation was not updated, the agent should briefly explain why, for example:

- "No documentation update was needed because this was an internal refactor with no behavior change."
- "No documentation update was needed because this only fixed styling."
- "Documentation update was skipped because the relevant requirement is still unclear."

## Definition of Done

Before finishing a task, the agent should:

- Summary of changes
- Files changed
- Commands run
- Tests passed or failed
- Documentation updated or why it was not needed
- Any skipped checks and the reason
- Any risks, assumptions, or follow-up work
