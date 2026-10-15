# Website previous-period comparison verification

- Branch: `codex/website-period-comparison`, based on `b604fb48dd15d1e564993f4f865bd88b29dd5e2b`.
- Scope: local implementation and verification; no remote push, merge or deployment in this change.
- Feature behavior: see the “เทียบช่วงก่อนหน้าในการ์ด Dashboard” section of `docs/website-analytics.md`.

## Automated checks

- Pure comparison and service tests were written before their implementation and failed because the new APIs did not exist, then passed after implementation.
- Tests cover inclusive adjacent ranges, leap/year boundaries, the earliest supported calendar, confirmed zero versus missing dates, retention, incomplete source flags despite all dates being present, independent failures in either period, Bangkok midnight and a shared snapshot with upstream concurrency <=2.
- Real-component server rendering covers complete/partial/failed/zero/ongoing output and per-site independent results.
- Independent final review found two P2 issues. An ongoing range could conceal independent partial coverage, and changing the main dashboard header range dropped comparison mode. Regression tests reproduced both before correction. The corrections preserve coverage completeness independently of temporal status, and retain the comparison flag while replacing the header range.
- Final `npm run verify`: typecheck passed, ESLint 0 errors / 11 existing warnings, 1,028 tests passed / 4 skipped / 0 failed (1,032 total).
- Final `npm run build`: passed. Generated `public/sw.js` refreshed through the build script; the full verify run afterward passed its reproducibility test.
- `git diff --check`: passed. No new dependencies or migrations.

## Browser verification

Used the actual production React components in a local QA harness with explicitly labelled fixture data. This verifies component interactions and layout, not authenticated data on a deployed environment. Server orchestration and date calculations are covered separately by the tests above.

- Daily overlay: both real dates appear in tooltip, confirmed zero is drawn, missing dates remain gaps, and all five sites can be selected.
- Complete periods show percentage/count change. A partial report shows day counts and no change. Either-side source failure preserves the other side. A zero baseline shows count increase. An ongoing period suppresses the range change.
- Paired total bars show all five sites with the same scale, independent coverage statuses and readable values without requiring hover.
- Turning comparison off restored both original graphs and retained the chosen metric. Turning it back on retained the total view and metric.
- Applying the real main-header range picker emitted `month=2026-10&dateFrom=2026-10-04&dateTo=2026-10-10&analyticsCompare=previous`, preserving comparison and clearing stale `analyticsFrom`/`analyticsTo` overrides.
- Checked desktop, 375×812 and 320×812. No page horizontal overflow. The daily tooltip at 320px remained within x=75..226.83 of the 320px viewport. Both modes remained available.
- No browser console errors during the final verification run. An initial QA-harness-only missing `process.env` shim was corrected before the final run; no application change was needed for it.

Screenshots and structured browser results are saved in the current thread's visualization directory as `website-period-comparison-desktop-qa.png`, `website-period-comparison-mobile-qa.png` and `website-period-comparison-browser-qa.json`.

## Compact presentation revision

Following user feedback, moved the switch beside the date control, collapsed current/prior totals and the percentage into one wrapping row, and replaced always-visible coverage counts/instructions with the existing Popover. The normal view has no repeated “ข้อมูลครบ” text. The paired total bars are shorter and no longer repeat period labels on every y axis. Full source dates, count differences, coverage, zero-baseline and ongoing/incomplete diagnostics remain available on activation.

The independent review of this revision identified loss of partial status for nonselected websites and an accessible-name mismatch on percentage buttons. A failing render regression reproduced the missing per-site status. Comparison mode now marks partial current totals in both the desktop table and mobile list; unsupported-prior fallback retains a short warning. Button names include the visible percentage/status plus “ดูรายละเอียด”, so assistive input can identify the displayed result.

Final revision checks:

- `npm run build` passed after the final source edits.
- `npm run verify` passed: typecheck, ESLint 0 errors / 11 existing warnings, 1,028 tests passed / 4 skipped / 0 failed.
- Real full-card components with fixture data checked on desktop, 375px and 320px. Closed popovers remove coverage prose from the layout; opening them restores both actual ranges, totals and source status. A partial report still displays 5/7 days and no change inside its details.
- At 320px the details popup occupied x=5..301 within the viewport, with no horizontal page overflow. Both original charts remained available after switching comparison off. No console errors during the final run.
- Evidence: `website-period-compact-desktop.png`, `website-period-compact-total.png`, `website-period-compact-mobile.png`, `website-period-compact-mobile-details.png`, `website-period-compact-qa.json` in the same thread directory. This revision was checked locally and has not been deployed.

## All-website Dashboard and single-website detail revision

The approved correction removes the single-site selector from Dashboard comparison. Daily mode shows five current/prior line pairs with stable website colors, solid/dashed periods and a shared tooltip listing each visible website. A website legend button hides both lines together; the last website with data cannot be hidden. Total mode keeps paired bars for every website. Coverage issues are grouped in one compact disclosure with per-website details.

The two-line single-site chart now belongs to `/admin/dashboard/websites`, using the existing website/date filters, an opt-in switch, three metrics and the compact totals/change summary. The page-only comparison flag does not broaden the reporting API contract. The prior request is scoped to the selected website and reuses the current report's timestamp, without rereading current data or house titles. All-houses lists skip prior reads while retaining the flag for return navigation.

Independent review found two P2 issues in this revision: isolated prior values were invisible between missing dates, and all-houses navigation dropped the comparison flag. The browser reproduced the first with a three-day prior series `[null, null, 648]`: the path had no visible segment and no dot. Small prior dots now preserve the single value (one dot verified). A rendering regression failed on the missing flag in “ดูทั้งหมด”, then passed after threading comparison through the table and pagination links. The follow-up review found no remaining actionable issues.

Browser checks used real components with fixture data locally, not an authenticated deployment:

- Dashboard rendered ten lines for five websites. Hiding one rendered eight, and hiding all but one rendered two with the final button disabled. Tooltip showed both actual dates and five website rows with current/prior values.
- Both original Dashboard views returned when comparison was disabled. Paired total mode remained usable at 320px.
- Detail selection changed from Poolvillapattaya (7,200/5,760) to baanPMhee (1,900/1,520), retaining comparison. Applying “เมื่อวานนี้” emitted a one-day October 14 range with the flag, a prior October 13 label and two plotted dots.
- Detail comparison handled partial, either-side failure, zero baseline and ongoing data, suppressing invalid percentages. Metric switching changed totals to 720/576 for contact clicks. Disabling comparison restored the original detail chart.
- At 320px and 375px, document scroll widths were 305px and 360px respectively (the remaining width is the scrollbar). Initial multi-site tooltip positioning extended beyond the viewport; constraining its width and anchoring it inside the chart fixed this. Final tooltip bounds were x=32..273 and x=32..328. Detail tooltip at 320px occupied x=74..225.83; issue details x=5..301. No console errors.
- Final evidence: `website-all-sites-comparison-desktop.png`, `website-all-sites-comparison-mobile.png`, `website-all-sites-comparison-mobile-tooltip.png`, `website-detail-comparison-desktop.png`, `website-detail-comparison-mobile.png`, and `website-overview-detail-qa.json` in the thread visualization directory.

Final checks after the last source edit: `npm run build` passed; `npm run verify` passed (typecheck, ESLint 0 errors / 11 existing warnings, 1,031 tests passed / 4 skipped / 0 failed; 1,035 total). Generated PWA source revision was refreshed by the build before the final reproducibility check. An earlier verify run overlapped a source edit and failed only the generated-worker reproducibility comparison; the final ordered build/verify run passed. `git diff --check` passed.

No dependencies, migrations, commits, pushes or deployments were added for this revision.
