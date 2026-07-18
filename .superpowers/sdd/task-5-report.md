# Task 5 report — Seller Settings Payment Method UI

## Direction

The seller settings page keeps the existing seller form intact and adds a
separate, ruled payment-method workspace beneath it. The visual direction is a
compact Document Workbench ledger: one clear section title, quiet horizontal
rules between methods, small action controls, and no competing card grid.

## Implementation

- The page loads the seller profile, bank catalogue, and account payment
  methods in one `Promise.all`.
- `PaymentMethodList` is reusable for `master` and `quotation` modes. It uses
  the existing `DragDropProvider`, `useSortable`, and `move()` primitives,
  normalizes positions after every mutation, and has no arrow-order controls.
- The master-only default switch is omitted in quotation mode. All five payment
  types use only their relevant fields. Built-in bank selection copies the
  catalogue identity/logo values; `OTHER` exposes a custom name and optional
  local PNG-logo upload. Upload action failures are visible inline.
- Seller save and payment-master save have independent state and actions; the
  existing WebP seller-logo conversion and `saveCompanyProfileAction()` flow
  were not changed.
- Added local compact SVG bank marks plus a source/trademark catalogue. No bank
  asset is hotlinked.

## Responsive implementation and Gridgeist review

- Base layout is one compact column; bank transfer recomposes to two tracks at
  `sm` and four at `lg`. PromptPay becomes two then three tracks. Every grid
  root has `min-w-0`; text controls use full width, so no fixed desktop track
  forces horizontal overflow.
- The drag handle, default switch, and delete affordance share the short header
  row without changing the controls' 2rem height. At narrow widths, method
  fields follow their type selector rather than shrinking into a desktop row.
- Review evidence: hierarchy is a single payment workspace; borders express
  ordered, draggable entries; labels are explicit; the default state has a
  labelled switch; drag/delete buttons have Thai accessible names; no added
  decorative cards, gradients, or dependencies.
- Live 390/768/1280/1536 inspection could not run: browser automation reported
  that no browser was available in this session. Static responsive review was
  completed from the Tailwind breakpoints above.

## TDD and verification

- RED: `node --import ./tests/register-server-only.mjs --test
  tests/quotation-ui.test.ts` failed because
  `payment-method-list.tsx` did not exist (36 pass, 1 fail).
- RED refinement: the focused source test then failed for missing upload-action
  error handling.
- GREEN: focused UI suite passed (37/37).
- `npm.cmd run typecheck` passed.
- `npm.cmd run lint` passed with the existing seller-logo raw-`img` warning
  only (no errors).
- `npm.cmd run test` passed (270/270; local database integration remains the
  suite's documented skip).
- `git diff --check` passed.
- Final verification after the PromptPay type-transition regression test:
  `npm.cmd run typecheck` passed; `npm.cmd run lint` passed with the existing
  seller-logo raw-`img` warning only; `npm.cmd run test` passed (271/271);
  and `git diff --check 95274a3..HEAD` passed.

## Files

- `components/admin/quotations/payment-method-list.tsx`
- `components/admin/quotations/company-profile-form.tsx`
- `app/admin/quotations/settings/company/page.tsx`
- `public/quotation/banks/README.md` and 17 local SVGs
- `tests/quotation-ui.test.ts`

## Documentation

No existing product documentation was changed: the approved payment-method
design and implementation plan already describe this behavior. The local bank
asset catalogue was added because it is required to track source URLs and
trademark ownership.

## Live follow-up verification

- Live 390px inspection found a controlled bank select whose `OTHER` state did
  not match its UUID-valued option; the explicit `OTHER` option now keeps the
  visible choice and conditional custom-bank fields in sync.
- Live 768px inspection found a native file input wider than its grid cell;
  both the wrapper and input now use `min-w-0 w-full max-w-full`.
- QR inputs are visible only for `qrMode: "upload"`, including QR Payment; the
  label is configurable and custom-bank logos and QR images now have distinct
  Thai labels.
- Final focused UI tests passed (40/40), typecheck passed, lint had 0 errors
  with the existing raw-`img` warning, full tests passed (273/273), and
  `git diff --check fb33ddb..HEAD` passed. Follow-up review: approved.

## Review fix: PromptPay QR transition

- RED: added a focused `quotation-ui.test.ts` regression test for changing a
  PromptPay payment method with `qrMode: "auto_promptpay"` to a non-PromptPay
  type. The prescribed focused suite failed as expected (37 pass, 1 fail): the
  type selector called the generic `update("type", ...)` path and left the
  incompatible QR mode untouched.
- GREEN: added `updateType()`, used only by the type selector. When leaving
  PromptPay it changes `auto_promptpay` to `none`; uploaded QR state is left
  intact because it remains compatible with other payment types. No seller
  profile behavior changed.
- Result: `node --import ./tests/register-server-only.mjs --test
  tests/quotation-ui.test.ts` passed (38/38), `npm.cmd run typecheck` passed,
  and `git diff --check` passed.

### Review-fix files

- `components/admin/quotations/payment-method-list.tsx`
- `tests/quotation-ui.test.ts`
- `.superpowers/sdd/task-5-report.md`

## Live-browser follow-up: payment controls

- The 390px inspection found that a newly added bank-transfer method had
  `bankId: null` and `bankCode: "OTHER"`, while the controlled native select
  used the literal `"OTHER"` against UUID-only options. The browser therefore
  rendered the first Bangkok bank although the custom-bank fields were shown.
  The select now has one explicit `OTHER` option and excludes any catalogue
  `OTHER` row; built-in banks retain their UUID values.
- `paymentMethodEditorState()` is the single UI state decision: built-in banks
  hide custom name/logo fields; `OTHER` shows both; `qrMode: "none"` hides QR
  upload and `"upload"` shows it. The image input keeps its old default label,
  and callers now use distinct Thai labels for custom bank logo and QR image.
- The 768px inspection found the native file input was about 316px wide in a
  roughly 202px grid cell. Its label wrapper and input now use `min-w-0`,
  `w-full`, and `max-w-full`, keeping the control in the compact responsive
  grid without reducing its touch target.

### TDD and verification

- RED: `node --import ./tests/register-server-only.mjs --test
  tests/quotation-ui.test.ts` failed because `paymentMethodEditorState` was not
  exported.
- GREEN: the same focused suite passed (40/40). The executable test asserts
  `OTHER`, built-in, and QR control states; the focused UI contract also covers
  the explicit native option, distinct labels, and 768px width classes.
- `npm.cmd run typecheck` passed. `npm.cmd run lint` passed with the existing
  seller-logo raw-`img` warning only. `npm.cmd run test` passed (273/273; one
  documented local database integration skip).

## Re-review fix: executable PromptPay QR transition

- RED: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`
  failed because `updatePaymentMethodType` was not exported.
- GREEN: the UI uses `updatePaymentMethodType()` for type changes; it changes
  `auto_promptpay` to `none` when leaving PromptPay. The regression test creates
  a PromptPay method with automatic QR, transitions it to cash, and asserts both
  the new type and valid `qrMode: "none"` state.
- Verification: focused UI suite passed (38/38) and `npm.cmd run typecheck`
  passed.

## Re-review fix: QR upload visibility and tablet containment

- RED: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts`
  failed as expected (38/40): `qr_payment` with `qrMode: "none"` still exposed
  the upload control, and the image wrapper lacked `w-full`.
- GREEN: `paymentMethodEditorState()` now exposes QR upload only when
  `qrMode === "upload"`; the focused regression covers both `qr_payment` modes.
  `PaymentImageInput` adds `w-full` while retaining `min-w-0 max-w-full`.
- Verification: focused UI suite passed (40/40), `npm.cmd run typecheck` passed,
  and `git diff --check` passed.

## Final review fix: type-entry QR defaults

- RED: two pure `quotation-ui.test.ts` regressions start from
  `emptyPaymentMethod("bank_transfer")`. The focused suite failed (40/42):
  entering QR Payment kept `qrMode: "none"`, and entering PromptPay also kept
  `"none"`.
- GREEN: `updatePaymentMethodType()` now assigns `"upload"` for QR Payment and
  `"auto_promptpay"` when a no-QR method enters PromptPay. Existing uploaded
  QR state remains intact for compatible types; leaving PromptPay still clears
  only its incompatible automatic mode. `PaymentMethodList` already routes the
  type selector through this helper and renders the upload input from that mode.
- Focused UI suite passed (42/42); `npm.cmd run typecheck` passed;
  `npm.cmd run lint` passed with the existing seller-profile raw-`img` warning
  only; `npm.cmd run test` passed (275/275; one documented local database
  integration skip); and `git diff --check` passed.

## Latest review fix: transition render state

- RED: the focused UI suite failed because the transition editor state had no
  `showQrUpload` field (actual `undefined`, expected `true`).
- GREEN: the existing QR-upload render flag is now named `showQrUpload` and
  used by the payment editor. The regression calls `paymentMethodEditorState()`
  on the actual updated bank-to-QR Payment and bank-to-PromptPay rows, proving
  the upload state and automatic PromptPay mode together.
- Verification: focused UI suite passed (43/43); `npm.cmd run typecheck`
  passed.
