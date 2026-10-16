# Development tooling mitigation — 16 October 2026

## Finding and upstream status

The eight high findings in the full audit share one underlying advisory:
[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
`braces@3.0.3` recursively walks deeply nested brace/parenthesis syntax and can
exhaust the JavaScript call stack. The affected dependency paths are:

- `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`
- `shadcn → fast-glob → micromatch → braces`
- `shadcn → ts-morph → @ts-morph/common → fast-glob → micromatch → braces`

As checked on this date, npm still publishes `braces@3.0.3` as latest, the
advisory lists no patched release, and current ESLint/shadcn versions retain
these dependency paths. Downgrading to Next.js 14 tooling or shadcn 1 merely to
change the audit result is not a compatible remediation. No forced audit fix,
new dependency, third-party fork, version spoofing, or audit suppression is used.

## Local backport

`npm install` and `npm ci` run `scripts/patch-braces-depth.mjs` in `postinstall`.
It patches every installed copy of `braces` listed in the lockfile. It accepts
only upstream `3.0.3` with known SHA-256 source fingerprints, or exactly the
already-patched files, and refuses unexpected code before writing any file in
that package. Production-only installations without `braces` skip the patch.

The parser bounds structural nesting to 100 before creating deeper brace or
parenthesis nodes. Compile, expand and stringify walkers also carry a hard depth
bound, including when callers supply AST objects directly. Over-limit input
throws an explicit `RangeError` before stack exhaustion; callers should handle
invalid patterns as they already handle the package's length/range errors.
Normal brace expansion, range patterns, escaped literals and glob syntax remain
available. `tests/braces-security.test.ts` covers malicious strings, unbalanced
input, caller-supplied ASTs and cycles, normal patterns, repeated patching and
refusal of changed upstream source.

Do not install with `--ignore-scripts` when using development tooling: it bypasses
the backport. The security tests in `npm run verify` fail if the patch is absent.
Review the patch when upgrading these dependencies. Once a supported upstream
release removes/fixes the affected code, upgrade, remove this backport and its
postinstall hook, and retain suitable regression checks.

## Audit interpretation

The real `braces@3.0.3` package identity is preserved, so `npm audit --include=dev`
still reports **eight high findings**. This is a local mitigation, not an
upstream release or a clean full-audit result. The scheduled development audit
remains unchanged and continues to report the advisory. Production-only
`npm run audit:security` remains a separate check.

## Verification

- Clean `npm ci` completed and automatically applied the backport.
- Five focused security/install-integrity tests passed, including refusal of
  partially applied patches that would reset recursion depth on every call.
- `npm run verify` passed: typecheck and lint completed; 1,044 tests passed,
  four skipped, zero failed.
- `npm run build` completed; shadcn CLI help and fast-glob scanning of the
  project's brace-pattern paths also completed.
- Independent code review found no remaining actionable issues after the
  partial-patch validation fix.
- Regenerated `public/sw.js` so its committed release fingerprint can match the
  updated package manifest and lockfile when this change is committed.
