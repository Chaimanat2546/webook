# Dashboard new-house return navigation — 2026-10-12

## Behavior

- Overview new-house preview links include the allowlisted `from=overview` source marker and selected month.
- House-detail Back returns to the originating overview month. Normal list-origin details retain the original list search, sort, and page.
- House management links preserve the exact detail return URL. Image management and cover ordering now use the shared safe return validator rather than a list-only duplicate.
- No shell, calendar, table, or card layout changes; no dependency additions; no web deployment.

## Verification

- TDD: real overview SSR initially failed on the missing origin marker; it passed after the href/route change. Real image-page SSR initially failed on the dropped dashboard return URL; it passed after reusing the shared validator.
- Coverage includes selected month, normal list filters, management return URL, image and cover modes, unsafe external URL fallback, invalid/repeated source markers, and the original house-list return URL.
- `npm run verify`: TypeScript passed; lint had 0 errors and 11 existing warnings; 995 tests, 991 passed, 4 skipped, 0 failed.
- Updated source-only image assertions that required the removed duplicate validator; runtime SSR now covers the preserved behavior.
- `public/sw.js` regenerated with `npm run build:pwa` because its app-source fingerprint must change alongside shipped code.
- Independent read-only reviewer approved the core fix and the subsequent image-flow correction.
- Final `npm run build` passed (exit 0) using the existing isolated Staging build checkout, not the active localhost checkout; shipped-source fingerprints match. Build emitted the existing generated-CSS selector warning, isolated-copy lockfile warning, and verification wrapper's Node child-process shell deprecation warning. No deployment command ran.

Production database migration is recorded separately in `2026-10-12-production-ical-migration.md`; it does not deploy these UI changes.
