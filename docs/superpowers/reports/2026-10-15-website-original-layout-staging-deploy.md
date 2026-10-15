# Restored website chart UI — Staging deployment and QA

Deployed the existing restored UI on 2026-10-15. This report supersedes the deployment state in `2026-10-15-website-original-layout-qa.md`; no additional product redesign was made during deployment QA.

## Deployment

- Command: `npm run deploy:cf:staging` — exit 0, including the OpenNext production build.
- URL: https://webook-staging.chaymanus2003.workers.dev
- Worker: `webook-staging`, version `afd72826-1d90-44d0-bdc5-00321a6ed936`.
- Verified target before deployment: Supabase `https://sxvkhzhqtrpxgzumsswl.supabase.co`, Cloudflare account `0df55f166fa309dcc904e992c43f86db`.
- Post-build scan including hidden/ignored build output: Staging project reference in 16 files, Production reference in 0 files. No environment secrets were printed.
- Live Dashboard and website-detail JavaScript chunks returned 200 and matched the SHA-256 of the build assets. Login returned 200; anonymous Dashboard redirected to login (307); anonymous analytics API returned 401.
- Completed the Staging PWA update prompt before authenticated browser checks. No Production deployment, commit, push or merge was performed.

## Authenticated live checks

Restored the normal date/view/metric/website-legend arrangement. No all-websites picker or separate primary/comparison website rows remain. Adding comparison places its date and remove action beside the original date control.

- Normal daily and original total views work. Visits is the initial selected metric.
- With all five sites visible, comparison rendered ten current/prior lines. Clicking Poolvillapattaya once removed both of its lines (eight remained); clicking the same legend name restored both (ten). This shared visibility also works in total view and survives date/view changes and removing/re-adding comparison.
- Compared actual daily tooltip sums against total-view values for all five sites and all three metrics, both before and after independently changing dates: all matched.
- Initial main range: October 13–14; comparison: October 11–12. Values below are visits / combined contact clicks / gallery opens.

| Website | Main | Comparison |
| --- | --- | --- |
| Baan Party Pattaya | 8,956 / 1,067 / 2,256 | 8,006 / 1,147 / 2,095 |
| Poolvillapattaya | 5,708 / 114 / 1,348 | 5,144 / 123 / 1,345 |
| baanPMhee | 2,365 / 6 / 1,023 | 1,720 / 9 / 784 |
| Fluk Nasa Poolvilla | 448 / 2 / 35 | 176 / 4 / 17 |
| Villa Media Poolvilla | 1,537 / 13 / 630 | 2,020 / 12 / 935 |

- On the mobile calendar, manually changed comparison to October 8–10 while keeping main October 13–14. Subsequently used the original primary-date shortcut to select October 14 only; comparison October 8–10 and hidden website stayed intact. Repeated the five-site/three-metric sum checks successfully with these unequal one-day/three-day ranges. The longer tail remained, with actual dates and an outside-selected-range label for the shorter side.
- Website detail preserved scope during navigation. Verified hiding the primary site, removing comparison, the explicit show-site recovery action, and changing the primary website.
- All-house list, page 2 of 54 (532 rows), sorting, DV-9 search, return to overview and return to Dashboard retained comparison dates. The existing monthly detail mode rendered May–October without a custom daily range.
- No browser console errors were recorded.

## Mobile checks

Used browser viewport simulation at 375px and 320px, not physical phones. Comparison calendars fit the viewport (242px wide). Selected a range in another month, applied it, edited a draft and cancelled without changing the applied URL. Future dates were disabled.

At 320px the document client and scroll widths were both 305px (excluding the scrollbar); no page-level horizontal overflow. Remove-comparison hit area was 44×44px. Original multi-metric bars scrolled inside their own region: 241px client width, 774px scroll width, scrollLeft changed to 214; page width remained 305px.

## Deterministic fixture data and edge cases

Fixture QA used the actual React components in a separate local harness. No fixture values or simulated failures were written to Staging.

Baseline: main October 8–14 versus comparison October 1–7, 2026. Baan visits were `[1200,1400,1100,1500,1300,1700,1800]` versus `[1000,1100,900,1300,1100,1200,1400]`. Website multipliers were `1`, `.72`, `.19`, `.08`, `.34` in the order above; rounded daily contact counts were 10% and gallery opens 20% of visits. This yields Baan totals 10,000/1,000/2,000 versus 8,000/800/1,600, or +25%. Rounding for baanPMhee contact clicks correctly gives 191 versus 153 (+24.8%).

| Case | Test input | Observed result / evidence filenames |
| --- | --- | --- |
| Normal and comparison | Baseline five sites, three metrics | Original views, ten lines, shared hide/show and totals work; `test-01` through `test-07` |
| Incomplete data | Remove first two Pool comparison days | 7,200 versus 4,248; comparison 5/7 days; no percentage for that site, other complete sites retain theirs; `test-08`, `test-09` |
| Missing daily rows | Same incomplete data | Missing value is —, not zero; line does not bridge the missing days; `test-10` |
| Comparison failure | Pool prior status timeout, no totals/daily | Main 7,200 remains, prior —, load-failed label, no percentage; `test-11` |
| Main failure | Pool current status timeout | Main —, prior 5,760 remains, no percentage; `test-12` |
| True zero baseline | All seven Pool prior days confirmed zero | Main 7,200 versus 0, increase-from-zero count; no Infinity/NaN/percentage; daily tooltip shows 0 distinctly from —; `test-13`, `test-15` |
| Ongoing day | Main ends October 14; snapshot October 14 03:00 UTC | Day-not-finished label, no percentage; `test-14` |
| Future selection | Today October 15 | October 16 disabled; `test-16` |
| Independent dates | Main October 8–14, comparison September 1–10 | Manual month navigation, apply and cancel work; ten-day tail retained with real September 10 date; no percentage for unequal lengths; `test-17` through `test-21` |
| Original mobile total | Remove comparison at 320px | Internal chart scrolling without page overflow; `test-22` |
| Website detail | Hide primary, remove comparison, show again, switch primary | Both periods hide together; recovery and site switch work; `test-23` through `test-27` |
| Last-site guard | Hide four of five sites | Remaining site cannot be hidden to produce zero visible sites; `test-28` |

## Verification and evidence

- `npm run verify` after deployment: TypeScript passed; ESLint 0 errors / 11 existing warnings; 1,043 tests total, 1,039 passed, 4 skipped, 0 failed.
- `git diff --check` passed. Independent implementation review is recorded in the preceding local QA report. Final deployment review checked target isolation, compiled/live assets, scope persistence, calculations, UI screenshots and browser errors.
- Evidence: **59 screenshots**, **27 live Staging / 32 deterministic fixture**, with captions, full-size links, recorded observations and a self-contained HTML album.
- Album: `C:/Users/chaym/.codex/visualizations/2026/10/15/01a13dcd-f5b0-79b0-9919-281907b5a9ca/staging-restored-ui/index.html`.
- Evidence report: same directory, `REPORT.md`; raw observations: `results.json`; validated screenshot metadata and checks: `manifest.json`.
- Screenshots retain original browser pixels. Browser screenshot bytes are JPEG although saved with the capture helper's `.png` names; the album embeds and serves their detected MIME type correctly.
- Logs remain ignored under `.superpowers/website-original-layout-staging-{deploy,verify}.log`. Only the local static evidence album server remains available; the fixture test server and temporary fixture tab were closed and the viewport override was reset.

Scope: verified the changed analytics Dashboard/detail/list paths and the stated fixture cases, not every unrelated admin module, every account or physical mobile device. No GitHub CI run was triggered because no code was pushed in this task.
