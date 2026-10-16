# OpenNext security remediation — 16 October 2026

Staging deployment of PR #92 stopped at `npm run audit:security` because
`@opennextjs/cloudflare@1.20.1` is affected by
[GHSA-2vc4-c4r6-p6v6](https://github.com/advisories/GHSA-2vc4-c4r6-p6v6).
Encoded paths can bypass middleware protection when cache interception is enabled.

Upgrade and pin `@opennextjs/cloudflare` to `1.20.2`, the first patched release.
Its `@opennextjs/aws@4.1.0` dependency contains the encoded-path fixes. Keep the
existing R2 cache configuration and Next.js `16.3.8` unchanged. Newer adapter
patches selected by `^1.20.2` currently require Next.js `16.4.1` or later, so the
exact pin avoids combining this security fix with a framework upgrade.

`npm run audit:security` reports zero production dependency vulnerabilities after
the upgrade. The separate full audit still reports eight high findings through
development tooling (`braces`, `micromatch`, `fast-glob`, ESLint and shadcn);
these are not covered by the production-only audit command. Do not use
`npm audit fix --force` to downgrade framework tooling as part of this fix.

Staging continues through `.github/workflows/deploy-staging.yml`: validation,
existing migration runner, and `npm run deploy:cf:staging`. The deployment uses
Worker `webook-staging`, Cloudflare account
`0df55f166fa309dcc904e992c43f86db`, and Supabase
`https://sxvkhzhqtrpxgzumsswl.supabase.co`. The workflow checks the built Worker
contains the Staging Supabase reference and excludes the Production reference.
