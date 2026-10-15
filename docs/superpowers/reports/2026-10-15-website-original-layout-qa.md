# Restore the original website chart layout

User correction: the original UI was already suitable; restore its placement and styling instead of redesigning the chart controls. This revision supersedes the dataset-row layouts in the preceding local QA reports. No deployment, commit or push was performed.

- Used the original `HEAD` Dashboard summary, graph and daily legend as the visual baseline. Restored the primary date picker to the card header, followed by the existing daily/total and metric controls, then the existing flex-wrap website legend above the chart. Removed dataset heading rows and the forced two-column website list.
- The optional comparison adds only a compact Add/date/X control beside the original date picker. The primary calendar retains its original shortcuts and confirmation flow. No duplicate primary date or website controls are added.
- Extracted the original legend markup/styles into a shared feature component for daily/comparison/total graphs. Hidden names remain in the legend and can restore both periods. Comparison lines receive all source rows plus the shared hidden keys; total bars filter rows while retaining the full legend.
- Restored the detail page date filter above the report and compact comparison control in the chart header. The ordinary detail chart retains its original layout. A hidden primary website has an explicit Show action in the otherwise empty chart so it can be recovered after removing comparison.
- Website hiding remains temporary client state, matching the original legend. Header date/Add/X actions retain component identity and preserve these local choices; they do not rewrite the URL on every website click. No backend/API/dependency changes for this correction.

## Verification

- Rendering regression first failed because header controls recreated primary-date/website rows, then passed after restoring placement. The existing summary date-control check now again expects its original label.
- `npm run build` passed. `npm run verify` passed: TypeScript, ESLint zero errors / 11 existing warnings, 1,039 tests passed / four skipped / zero failed (1,043 total). `git diff --check` passed.
- Independent review found no important implementation regression. Removed obsolete fixture props and checked the final focused render assertions against the compact controls.
- Real-component browser checks used labelled local fixtures and the app font, not Staging or a physical phone. Checked 1280×900, 320×812 and 375×812.
- Verified the normal screenshot matches the original date/view/metric/legend arrangement. Hiding Poolvillapattaya, then adding comparison, hid both its current/prior paths. Clicking its still-present legend name restored both. Total view retained the hidden name and omitted its bars until restored.
- Changed comparison to October 3–5 and primary to October 14 using the original primary date shortcut. The other range and temporary shared hide remained intact. X restored the ordinary chart without revealing the hidden website; re-add retained the hide.
- At 320px the X button remained 44×44px within the card; document client and scroll widths both 305px (15px scrollbar). Detail date filter and native comparison legend were present; Show restored a hidden ordinary detail chart. Console errors: none.
- Reset viewport override and closed the temporary QA tab/server.

Evidence in the thread visualization directory: `website-original-layout-qa.json`, `website-original-layout-normal-desktop.png`, `website-original-layout-comparison-desktop.png`, `website-original-layout-mobile320.png`, `website-original-layout-mobile375.png`.
