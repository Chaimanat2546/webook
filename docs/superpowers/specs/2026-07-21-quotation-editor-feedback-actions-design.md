# Quotation Editor Feedback and Actions Design

Date: 2026-07-21  
Status: Approved design

## Goal

Make create/edit quotation actions easier to understand, remove duplicated controls, and replace noisy page-level validation summaries with concise Toast feedback plus inline field errors.

## Scope

This change affects only the quotation create/edit workbench. It does not change quotation calculations, persistence, permissions, database schema, public sharing rules, PDF generation, or upload APIs.

## Action hierarchy

The desktop command header keeps three primary workflow actions:

- กลับ
- ดูตัวอย่าง
- บันทึก

The existing mobile bottom command bar keeps the same three actions.

The seller/document action row contains the saved-document operations:

- แชร์
- พิมพ์
- ดาวน์โหลด
- ลบใบเสนอราคา

Remove the `เพิ่มเติม` menu and its duplicated Back, Preview, and Save actions. `ลบใบเสนอราคา` is an explicit secondary destructive button placed after Download and appears only after the quotation has been saved. Existing saved/dirty/readiness gates for Share, Print, and Download remain unchanged.

## Save feedback and validation

When saving fails because fields are invalid:

1. Show one error Toast: `กรุณาตรวจสอบข้อมูลที่กรอก`.
2. Open the relevant completion tab when the first error belongs to payment or certification data.
3. Scroll or focus the first invalid control.
4. Keep the existing error message beside each invalid input with its accessibility attributes.

Do not render the field-error summary Alert at the top of the editor. Do not create one Toast per field.

When saving fails because of a form/server error, show the returned safe message in one error Toast. Do not duplicate it in a page-level Alert.

Persistent calculation errors remain in-page because they describe an ongoing document state rather than the result of one action.

Delete errors stay scoped to the delete Dialog and also produce an error Toast. Save and delete error state must not leak into each other.

## Confirmation dialogs

All confirmations initiated by controls inside the editor use the existing shadcn/Radix `Dialog` pattern:

- leaving through Back with unsaved changes;
- disabling item discounts when values would be cleared;
- disabling item VAT when values would be cleared;
- deleting a saved quotation.

The Dialog states the consequence, provides a neutral Cancel action, and uses an explicit destructive confirmation label. Cancel preserves the current draft and values. Confirm performs exactly the pending action.

Browser refresh, browser Back, and tab/window close continue to use the native `beforeunload` prompt because browsers do not permit a custom modal for that boundary.

## Responsive and accessibility behavior

- Desktop keeps the primary actions in the command header.
- Mobile keeps the three-column bottom command bar; document actions remain in their responsive action row and may wrap without horizontal overflow.
- Dialogs trap focus, close on Escape where safe, return focus to the triggering control, and expose a title and description.
- Destructive actions are identified by label and styling, not color alone.
- Toasts supplement inline errors; they do not replace field labels, descriptions, or focus management.

## Implementation boundary

Expected files:

- `components/admin/quotations/quotation-editor.tsx`
- `tests/quotation-ui.test.ts`
- `docs/quotation-management.md`

Reuse the existing Dialog, Button, and Sonner components. Do not add dependencies or create a new shared confirmation abstraction unless the existing editor cannot express the four confirmed actions with one small local state model.

## Verification

Automated checks must cover:

- primary actions are not duplicated;
- the More menu is absent;
- Delete is explicit, destructive, and saved-only;
- field validation produces one Toast, retains inline errors, and focuses the first invalid control;
- page-level save/field error Alerts are absent while calculation errors remain;
- every in-editor confirmation uses Dialog instead of `window.confirm`;
- cancelling and confirming each dialog preserves or applies data correctly;
- browser unload protection remains enabled for dirty drafts.

Run typecheck, lint, the full test suite, and production build. Manually verify narrow mobile, tablet, and desktop layouts when browser tooling is available.

## Out of scope

- replacing the native browser unload prompt;
- changing server validation messages;
- changing share, print, PDF, or Public URL availability rules;
- changing quotation workflow or adding document statuses;
- redesigning settings pages or the quotation list.
