# Quotation Workbench UX Polish Implementation Plan

**Goal:** Complete MVP 2 of the approved quotation UX polish without changing quotation payloads, calculations, persistence, or saved-document rules.

**Scope:** Keep the existing `QuotationEditor` and shared UI primitives. Adjust only action hierarchy, mobile access to primary actions, form feedback, and accessible error association. Preview continues to use the current draft; Print, PDF, and Share continue to use the latest clean saved payload.

**Files:**

- `components/admin/quotations/quotation-editor.tsx`
- `tests/quotation-ui.test.ts`
- `docs/quotation-management.md`

## Task 1: Workbench action hierarchy

1. Update quotation UI regression assertions for the approved header title and Back/Preview/Save actions.
2. Run the focused test and confirm it fails.
3. Change the desktop header to show `ใบเสนอราคาใหม่` or the document number.
4. Add a mobile-only bottom command bar with Back, Preview, and Save using the same handlers and pending state as desktop.
5. Add bottom clearance and safe-area padding so the bar does not cover the completion tabs.
6. Keep Share, Print, Download, and overflow actions in the seller strip.
7. Run focused tests and typecheck.

## Task 2: Save and validation feedback

1. Add failing assertions for success/form-error Toast behavior, scroll-and-focus, and `aria-describedby` error links.
2. Reuse Sonner for save success and task-level save failure; keep field errors inline.
3. Give repeated field errors stable IDs derived from the existing field path and connect controls with `aria-describedby`.
4. Scroll the first visible invalid control into view before focusing it, after switching payment/certification tabs when needed.
5. Preserve current payload, dirty state, upload gate, navigation, and saved-document gating.
6. Run focused quotation UI and quotation business-logic tests.

## Task 3: Documentation and responsive verification

1. Document the revised action placement, mobile command bar, and validation feedback in `docs/quotation-management.md`.
2. Verify 390px, 768px, 1024/1280px, and desktop layouts with no page-level horizontal overflow or covered content.
3. Verify keyboard access to header actions, item reorder controls, completion tabs, and dialogs.
4. Verify Preview uses draft data while Print/PDF/Share remain saved-clean only.
5. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
6. Request read-only project review, fix only evidence-backed findings, and rerun affected checks.

## Explicit non-goals

- No database, RLS, RPC, repository, service, payload, validation-rule, or calculation changes.
- No new dependencies or shared form abstraction.
- No autosave, navigation framework, document status, or adjacent settings/preview polish from later MVPs.
