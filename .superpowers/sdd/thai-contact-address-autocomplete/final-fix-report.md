# Final P1 Fix Report

## Scope

Fixed manual Province → District → Subdistrict selection so a selected Subdistrict with exactly one postal code updates `postal_code`, regardless of any prior postal lookup or the current lookup candidates.

## Contract

The authenticated subdistrict-list contract now returns each active subdistrict option's own `postalCodes` only. The client does not receive the country-wide data set or parent metadata.

## Regression coverage

`tests/booking-customer-address-ui.test.ts` executes the selection controller through the manual Province → District → Subdistrict path and verifies the uniquely-postcoded subdistrict emits `postal_code: "20110"`.

## Verification

- Focused Thai address tests: passed (18 tests).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed.
- `npm run build`: passed.
