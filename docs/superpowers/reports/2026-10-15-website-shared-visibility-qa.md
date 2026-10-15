# Shared website visibility — QA

This revision supersedes the independent website-toggle rows in the preceding local revision. The user requested one website list: hiding a website hides both its primary and comparison series. Only the two date ranges remain independently editable. No deployment, commit or push was requested or performed for this revision.

## Implementation and review

- Reused the existing date pickers and buttons. Removed the duplicate website list and replaced two visibility states with one. The same visibility applies to ordinary daily, comparison daily and total views. Source summary totals are not mutated or filtered by graph toggles.
- Hidden comparison rows are removed as a whole, so neither period's values or percentage remain. Confirmed zero and source coverage rules remain intact.
- Date/add/remove navigation serializes the same website keys for both periods. Existing independently scoped links initialize from the primary website selection; the separate comparison website selection no longer controls visibility.
- A render regression first failed with two website groups versus the required one, then passed after implementation. The pure visibility test verifies both periods disappear, true zero remains, source reports stay unchanged and showing a website restores both values.
- Independent review identified detail-page selection loss across X/re-add and a newly selected primary report being hidden. Both were reproduced or covered by failing regression tests, then fixed. The detail hook retains a stable registry universe; explicit primary-site navigation reveals the chosen website in the shared selection while keeping comparison dates.
- If the primary detail website is hidden while only another comparison website remains visible, removing comparison keeps that choice and displays “เว็บไซต์นี้ถูกซ่อนในกราฟ”; it does not mislabel this state as a source load failure. Re-adding comparison restores the saved shared selection. This state has a render regression test.
- Final independent review found no important remaining issues in those fixes. No dependencies, schema or deployment configuration changed.

## Browser verification

Used real React components, the application's Thai font and explicitly labelled local fixture data. This is viewport emulation, not physical-device or authenticated Staging verification.

- Normal graph: hid Poolvillapattaya, added comparison, verified both `site-1-current` and `site-1-previous` paths were absent. One click restored both paths. Exactly one website control group was rendered.
- Total graph: the hidden website's entire row disappeared; showing it restored both totals (1,872 primary / 2,160 comparison in the final unequal-range case). Switching views retained the shared choice.
- Changed comparison to October 3–5, then primary to October 13–14. Both ranges remained independent, both URL selections contained the same website keys, and both hidden paths stayed absent.
- Detail X/re-add preserved both A+B visibility and the edge case where only B was visible. Selecting a different primary website revealed its report and chart normally.
- At 320×812 the X button measured 44×44px, x=229, within the card. Document client/scroll width both measured 305px (15px scrollbar). Calendar bounds x=32, y=436, width=242, height=339 fit the viewport. Checked 375×812 and desktop 1280×900 as well. Website buttons retain 44px minimum height and mobile two-column layout.
- Console errors: none. Temporary tab/server closed and viewport override reset.

## Final checks

- `npm run build`: passed.
- `npm run verify`: TypeScript passed; ESLint zero errors / 11 existing warnings; 1,039 tests passed / four skipped / zero failed (1,043 total).
- A verification attempt during ongoing edits caught a generated-worker revision mismatch after source changed following generation. The final ordered build then verify run regenerated the worker from the completed source and passed.
- `git diff --check`: passed.

Evidence in the thread visualization directory: `website-shared-visibility-qa.json`, `website-shared-visibility-desktop.png`, `website-shared-visibility-mobile320.png`, `website-shared-visibility-mobile375.png`.
