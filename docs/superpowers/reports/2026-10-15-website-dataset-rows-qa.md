# Website dataset rows — implementation and QA

Approved revision: remove the “ทุกเว็บไซต์” selector and give the primary and optional comparison datasets their own date control and clickable website names. The controls keep the same meaning and location when comparison is added or removed. This revision is local and uncommitted; no deployment was requested or performed for it.

## Changes

- Reused the existing Button and ReportDateRangePicker. Removed the dataset configuration dialog and its duplicate website checkboxes. No dependencies or migrations.
- Primary controls always appear above the chart. Add comparison creates a second row, initially using the previous equal-length range and primary visible websites. Both calendars allow independent custom ranges with Apply/Cancel; X removes only comparison.
- Website names toggle temporary graph visibility independently in each dataset, with `aria-pressed`, line-through hidden names, 44px touch targets and a last-visible-site guard. On mobile names use two columns. Primary and comparison controls use the same structure; comparison markers are dashed.
- Client visibility is shared by daily and total views and serialized when dates, add or remove controls navigate. It does not mutate source totals or filter summary tables. Cross-page restoration of temporary local toggles is not part of this behavior; URL scope initializes visibility on a new page.
- The authorized page loaders read available allowlisted series for each date range once, so showing a previously hidden name does not need a new upstream read. No comparison reads when comparison is absent. Existing service boundaries, snapshot consistency, API contract and concurrency limit remain intact.
- Visible comparison rows mask the hidden side only. Hidden values cannot generate a percentage or a source failure, and hiding the same website in both datasets removes its graph row. Colors retain registry identity even when other rows are hidden.
- Removed the range-dependent Dashboard Suspense key so date navigation can retain graph view/metric state. Detail controls use the same rows; the existing primary single-website selector remains at page level. Full-house-list filters retain their own date picker.

## Verification

- Test-first rendering check failed because the old controls had no primary date/name row. The visibility test initially failed because the new masking function did not exist. Both passed after implementation.
- New pure test checks independently hidden datasets, daily values, totals, selected flags, true zero, unchanged source reports and restoring a visible website.
- Updated the existing date-control rendering expectation to its new primary label. The first full suite exposed that outdated expectation; the final full run passed.
- Independent code review found a fixed-color date legend beside website-colored detail lines. Corrected the legend to neutral line samples. No important logic findings remained under the graph-only temporary visibility requirement.
- Browser inspection found the comparison date button could consume the full row and clip the X touch area. Fixed the flex sizing and aligned dataset labels consistently on mobile; verified the complete 44×44px X button lies inside the card.
- Final `npm run build` passed. Final `npm run verify` passed: TypeScript, ESLint zero errors / 11 existing warnings, 1,038 passed / four skipped / zero failed (1,042 tests). `git diff --check` passed.

## Browser checks

Used actual React components in the local harness with explicitly labelled fixture data and the application's Noto Sans Thai font. These are not authenticated Staging checks or physical-device tests.

- Started ordinary, hid Poolvillapattaya in primary, then added comparison. The primary remained hidden and the comparison initialized from the primary selection.
- Showed Poolvillapattaya and hid Baan Party only in comparison. Daily line paths showed primary Baan Party and comparison Poolvillapattaya independently. Total view kept the same visibility; one-sided website rows did not show a percentage.
- Changed comparison to October 3–5 while primary remained October 8–14. Changed primary to October 13–14; comparison remained October 3–5 with its own visible websites. Cancel discarded a draft date.
- Removing comparison restored the ordinary chart while keeping primary Poolvillapattaya hidden. Re-adding initialized from the current primary selection rather than retaining removed comparison toggles.
- Detail navigation rendered the new rows, and showing a hidden comparison website rendered its prior line without changing the primary report.
- At 320×812 the X button measured x=229, width=44, height=44, within card right=289. Document client/scroll width both 305px (the remaining 15px is the scrollbar). Calendar bounds x=32, y=436, width=242, height=339 fit the viewport.
- At 375×812 document client/scroll width both 360px. Names and dates were usable without horizontal page overflow. Desktop checked at 1280×1000.
- Browser console errors: none. Temporary viewport override reset; local QA tab and server closed.

Evidence in the thread visualization directory: `website-dataset-rows-qa.json`, `website-dataset-rows-desktop.png`, `website-dataset-rows-mobile375.png`, `website-dataset-rows-calendar320.png`, `website-dataset-rows-detail320.png`.
