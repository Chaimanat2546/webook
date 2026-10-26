# Enforce owner report permission

Approved behavior: admins retain report access. Owners need a valid assigned DV
and literal `allow_tools.allow_report = true`; disabled/missing permission denies
menus, direct Dashboard URLs, report/detail loaders and customer actions.

Keep ownership (`dashboardScope`) separate from report permission so notification
ownership and receipt do not change. Reuse existing navigation/module guards and
the shared repository access check; no new UI component or dependency is needed.

1. Add failing permission/repository tests for enabled, disabled, missing and
   malformed flags, missing DV, admins, revocation and protected data loaders.
2. Add `dashboardReportScope` and fetch `allow_tools` in repository access.
3. Add a new migration that patches the existing report RPC with the same guard,
   preserving Production date-range and Staging time-window report definitions.
   Do not edit old migrations or apply the unrelated deferred Dashboard migration.
4. Test RPC rejection/revocation and cross-DV filtering on disposable PostgreSQL,
   including both deployed report variants. Test ownership-only notifications.
5. Review, run build/typecheck/lint/relevant tests, and update Dashboard docs.
