# Quotation payment information layout QA

- Source visual truth: `C:/Users/POOLVI~1/AppData/Local/Temp/codex-clipboard-f680e603-db73-4231-83de-ee3a2763816c.png`
- Implementation screenshot: `C:/Users/POOLVI~1/AppData/Local/Temp/quotation-payment-layout-viewport.png`
- Viewport: 1280 × 720, DPR 1.
- State: saved quotation Preview with one bank-transfer payment method.

## Full-view comparison evidence

- The payment heading remains in the left document column.
- The bank logo and its information now form one compact group to the right of the heading.
- The surrounding summary and notes sections retain their existing alignment and spacing.

## Focused region comparison evidence

- The bank details render in the requested order: bank name, account number, account name.
- The three values occupy one vertical stack beside a 36 × 36 px bank logo.
- The account number is emphasized and uses tabular numerals.
- The payment entry has no horizontal overflow.
- Existing typography, monochrome document palette, supplied bank asset, and app-specific copy were preserved.
- Browser console reported no errors.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested information ordering.
- The reference includes an account type before the number; the current data model does not store account type, so no invented value is displayed.

## Comparison history

1. Earlier P2: the bank name sat beside the logo while account number and account name occupied a separate column.
   - Fix: placed the bank name, account number, and account name in one vertical details container beside the enlarged logo.
   - Post-fix evidence: browser inspection returned the ordered children `ธนาคารกสิกรไทย`, `12356998565`, `ชัยมนัส แอบสุข`, with no overflow.

## Follow-up polish

- Add an account-type field only if the product later needs to display values such as `ออมทรัพย์`.

final result: passed
