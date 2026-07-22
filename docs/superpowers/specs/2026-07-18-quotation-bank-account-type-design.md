# Quotation Bank Account Type Design

## Goal

Add an optional bank account type to bank-transfer payment methods. The value is saved in the user's payment master, copied into each quotation snapshot, and shown in Preview/Print beside the account number.

## Scope

- Applies only to payment methods whose type is `bank_transfer`.
- Supported values:
  - `""` — ไม่ระบุ
  - `savings` — ออมทรัพย์
  - `current` — กระแสรายวัน
  - `fixed` — ฝากประจำ
- The field is optional. Existing data remains valid and resolves to `""`.
- No new payment type, bank catalogue field, or free-text account type is added.

## User Interface

The bank-transfer editor adds a compact select labelled `ประเภทบัญชี` with the four options above. The field order is:

1. ธนาคาร
2. ประเภทบัญชี
3. ชื่อบัญชี
4. เลขที่บัญชี
5. QR โอนเงิน

The existing responsive grid remains responsible for wrapping fields on narrow screens. PromptPay, QR Payment, cash, and other payment editors do not show the account-type field.

Changing a payment method away from `bank_transfer` clears its account type. Changing back does not restore the old value automatically.

## Data Model

Add `account_type text not null default ''` to both:

- `public.quotation_company_payment_methods`
- `public.quotation_payment_methods`

Each column has a check constraint allowing only `''`, `savings`, `current`, or `fixed`.

A new migration must alter the existing tables and update the current payment validation/save/read RPC boundary. Existing migrations must not be edited. Existing rows use the default empty string and require no data backfill.

The TypeScript payment-method model adds `accountType`. Repository mapping, master save payloads, quotation save payloads, and public quotation serialization must carry the field. A quotation always renders its saved snapshot rather than the current master value.

## Validation And Normalization

- Missing or empty values normalize to `""`.
- Any value outside the supported set produces a Thai field error on `paymentMethods.{index}.accountType`.
- For non-bank payment types, normalization clears `accountType` and removes irrelevant account-type errors.
- Database validation repeats the allow-list check at the trust boundary.

## Preview, Public View, And Print

The existing account-number line becomes:

- Specified: `{Thai account type} {account number}`
- Unspecified: `{account number}`

Examples:

```text
ออมทรัพย์ 123-4-56789-0
123-4-56789-0
```

No extra line or placeholder is rendered when the type is unspecified. Preview, public read-only view, and print use the same shared document component.

## Error Handling

- Invalid client values are rejected before the save RPC with a Thai field error.
- Invalid direct RPC values are rejected by the database validation boundary.
- Existing safe form-level save errors remain unchanged.

## Testing

Automated coverage must verify:

- all four values normalize correctly;
- invalid values are rejected;
- non-bank methods clear the field;
- new bank methods default to `""`;
- the master repository round-trips the value;
- quotation save creates an independent snapshot;
- database columns, constraints, validation, save RPCs, and public serialization include the field;
- the bank editor shows the select only for bank transfers;
- Preview/Public/Print show `{ประเภทบัญชี} {เลขที่บัญชี}` or only the account number when unspecified.

## Out Of Scope

- User-defined account types
- Account type on PromptPay or other payment methods
- Filtering or reporting by account type
- Updating old quotations from the current payment master
