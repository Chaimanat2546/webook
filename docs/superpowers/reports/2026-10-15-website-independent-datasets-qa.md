# Optional independent website datasets

Approved behavior: start with an ordinary graph. Primary dates/sites work without comparison. Optionally add one comparison dataset whose dates and website subset are independent. Remove comparison without changing the primary selection. Keep controls compact and mobile usable. This change is local and uncommitted; no deployment was requested for this revision.

## Implementation and boundaries

- Reused the existing Dialog, Button, ReportDateRangePicker and native labelled checkboxes already used in the project. No dependencies or migrations. The comparison dialog's calendar commits to the dialog draft after two date clicks; only the outer “ใช้กับกราฟ” loads data. No nested Apply step. The quick previous-range button fills a draft, not a mandatory comparison mode.
- A page-only `analyticsScope` stores primary site keys and an optional `{from,to,sites}` comparison selection. Validation rejects unknown keys, non-scalar/oversized input, unknown/duplicate/empty websites, invalid or future dates. Original API query validation remains unchanged. Existing `analyticsCompare=previous` links remain compatible.
- Services read each independently allowlisted website set at one captured snapshot, sequential dataset groups with existing max-two upstream concurrency. No comparison reads when absent; no duplicate current read or extra catalog title lookup on detail pages; all-houses lists still skip comparison reads.
- Daily rows use the union of selected website keys, distinguishing unselected from failed series. Alignment uses ordinal days and preserves the longer range's tail without inventing dates. Tooltips show both actual dates, or “นอกช่วงที่เลือก” beyond a shorter range. Missing days stay null, confirmed zeros stay zero. Total rows show selected bars only.
- Per-website differences require the same website in both datasets, equal day counts and both ranges confirmed complete and finished. Different website sets get actual values, not cross-site percentages. Unequal ranges show counts and no total percentage. Cross-year legends display years so the same month/day in different years cannot look identical.

## Test-first checks and review

- Pure parser/navigation/alignment tests and a service orchestration test were run failing before implementation, then passed. The service test asserts exact independent site/date/snapshot requests and that an explicit normal scope overrides a legacy compare flag.
- Rendering tests cover an ordinary add button with no forced switch, independent website rows without false source failures, existing partial/zero/failure/ongoing rules, and preserved navigation. A cross-year legend regression first rendered identical “8–9 ต.ค.” labels and failed; the fix includes both Buddhist years.
- Independent review found retained ordinary hidden-series state concealing selected comparison lines, and the ordinary detail monthly toggle dropping scope. Both reproduced in the real-component browser harness. After correction, comparison renders all selected lines regardless of ordinary hidden state; changing the primary website selection also resets its visibility scope. Monthly navigation and its Dashboard return link retain scope.
- The initial full suite exposed the future-month summary harness bundling the newly imported server registry without its external-dependency guard. Adding the same throw-on-read guard for the registry preserved the test's purpose (no analytics/registry reads for future months). The focused suite then passed. This was test isolation, not a production Client/Server boundary change.

## Real-component browser checks

Used actual React components with explicitly labelled fixture data in a local harness. These checks do not claim authenticated Staging verification or deployment.

- Started with all five ordinary website series, an “เพิ่มชุดเปรียบเทียบ” button and no comparison. Selecting only Baan Party produced one ordinary line; selecting Poolvillapattaya/baanPMhee produced two ordinary lines and no comparison URL state.
- Added Poolvillapattaya for September 1–3 while primary remained Baan Party October 8–14. The URL stayed unchanged until Apply. Selecting no websites disabled Apply; Cancel discarded edits. Both shorter and longer September 1–10 ranges were accepted.
- For the longer comparison, ten prior dots were retained versus seven primary days. Tapping the final prior mark showed September 10 = 648 and primary “นอกช่วงที่เลือก”. The total view showed primary Baan Party 10,000 and comparison Poolvillapattaya 7,920, without an invalid percentage or false missing-website warning.
- Detail navigation retained the independent selection. Changing primary to baanPMhee changed primary totals to 1,900 while Poolvillapattaya's comparison stayed 7,920 and September 1–10. Removing B returned the original detail chart.
- At 320×812 the settings dialog occupied x=16..304, y=87.5..724.5. The calendar occupied x=32..274, y=223.5..505.5. Both fit within the screen. At 375×812 document scroll width was 360px (remaining width is the scrollbar), with normal primary selection and all controls usable. Temporary viewport overrides are reset.

Evidence in the thread visualization directory: `website-datasets-desktop.png`, `website-datasets-mobile320-settings.png`, `website-datasets-mobile320-tooltip.png`, `website-datasets-mobile320-comparison.png`; final ordinary-state screenshots and structured results are saved alongside them.

## Final verification

- `npm run build` passed after the last product source edit, regenerating the PWA revision.
- `npm run verify` passed: TypeScript, ESLint zero errors / 11 existing warnings, 1,037 tests passed / four skipped / zero failed (1,041 total). The generated-worker reproducibility check passed in this ordered build/verify run.
- `git diff --check` passed. No new dependencies or migrations.
- Additional final screenshots: `website-datasets-normal-desktop.png`, `website-datasets-normal-mobile375.png`. Structured results: `website-independent-datasets-qa.json`. Final browser console errors: none; viewport overrides reset and the temporary QA tab/server closed.
- No commit, push, merge or Staging/Production deployment was performed for this revision.
