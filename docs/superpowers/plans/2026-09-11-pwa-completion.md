# WeBooks PWA completion implementation plan

> Execute in this task using superpowers:executing-plans, with behavior-first tests and review after each deliverable.

**Goal:** Complete the agreed PWA checklist except Store distribution and Push Notification, both deferred by the user.

**Architecture:** Keep authenticated data network-only. Shared client components expose connectivity, installation and share behavior. Workbox controls only allowlisted public offline assets. No push or mutation replay subsystem in this scope.

**Tech Stack:** Existing Next.js App Router, React, TypeScript, shadcn, Node test runner; user-approved Workbox 7.4.1 and esbuild 0.28.1.

**Spec:** `docs/pwa-checklist.md` and `docs/pwa-gap-analysis-2026-09-11.md`, approved as the direction by the user. Store is deferred.

## Constraints and decision boundaries

- Reuse Alert, Button, Dialog, Input, Sidebar and Sonner; no new UI library.
- No automatic mutation replay or storage of private records offline.
- No production deployment. Staging uses the approved project scripts after target verification.
- Do not fabricate physical-device results, delivery results or performance measurements.
- Workbox dependencies are approved. Push event/recipient selection is unnecessary because the user deferred Push entirely.

## Deliverables

### 1. Reliable sharing and online-state feedback

Files: `lib/pwa/share.ts`, `tests/pwa-share.test.ts`, `components/admin/quotations/quotation-editor.tsx`, `components/pwa/connection-status.tsx`, `components/layout/admin-shell.tsx`.

Contract: `shareLink({title, url}, capabilities)` returns `shared | copied | cancelled | manual`. Native share is attempted from the click, cancellation terminates the flow, unsupported or rejected sharing falls back to clipboard, and clipboard failure exposes the existing URL for manual copying. No new public token is created.

- [x] Add tests covering native success, AbortError cancellation without clipboard use, unsupported share, clipboard failure, and canShare rejection.
- [x] Run `node --test tests/pwa-share.test.ts` and establish failure before implementation.
- [x] Implement helper and integrate a manual-copy Dialog using existing UI components.
- [x] Add an accessible offline status without reload/retry of writes; online browser status is not represented as proof of server availability.
- [x] Catch quotation save transport failures locally, retain current form state and show uncertainty rather than success.
- [ ] Run focused tests, typecheck and browser checks for the visible flows.

### 2. Installation, route feedback and mobile interaction

Files: `components/pwa/install-app-menu-item.tsx`, shared PWA error UI, appropriate App Router loading/error files, `docs/pwa.md`.

- [x] Add Safari Mac and Firefox Windows instructions and clarify iOS installation options.
- [ ] Inspect actual route loading/error behavior before choosing boundaries that preserve editor state.
- [ ] Verify dialog overflow, keyboard/focus and layout at mobile and desktop sizes; repair concrete failures.
- [ ] Keep house workspace shell intact if a house route requires changes.

### 3. Workbox migration

Files: worker source/build integration, `public/sw.js`, `next.config.ts` or explicit build scripts, package manifests and worker tests.

- [x] After dependency approval, resolve compatible packages and choose one bundling/injection path.
- [x] Port existing five worker behaviors into tests against the generated artifact, with additional query and legacy update cases.
- [x] Use NetworkOnly navigation plus public fallback, revisioned allowlisted precache, no private runtime cache, and no forced activation.
- [x] Verify actual production output and all imported runtime files before browser tests.

### 4. Push subsystem — deferred by user; no implementation in this release

- [ ] Resolve event and recipient requirements from the user before implementing the business trigger.
- [ ] Write the concrete subsystem design and tests once those inputs are supplied: client opt-in, server authorization, subscription repository/RLS, sending adapter, worker push/click, expiry and account switching.
- [ ] Review any extra dependency separately; keys remain server-side.
- [ ] Verify real delivery only on authorized test accounts and record unsupported platform fallback.

### 5. Performance and release verification

- [ ] Record local production baseline and post-change observations under identical conditions; report limits of measurement.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` after code changes.
- [ ] Review changes against privacy, tenant authorization, dirty forms and lifecycle requirements.
- [ ] Verify Staging target/configuration before any requested test deployment.
- [ ] Update checklist with exact evidence and outstanding external/device requirements; do not tick unchecked requirements merely because code exists.
