# Login History Date and Time Picker Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this correction inline.

**Goal:** Reuse the complete dashboard picker, including its optional hourly window, for Login History.

**Architecture:** The shared picker emits date and hour values. History validates these values before the repository calls a root-only RPC. A new migration filters each Bangkok day's login timestamps before counting and pagination.

**Tech Stack:** React, TypeScript, existing dashboard/shadcn components, Supabase PostgreSQL, Node Test Runner.

**Spec:** The user's request to use the dashboard date picker includes its time controls. See `docs/login-history.md` for existing access and date semantics.

## Constraints and review focus

- Reuse `WebsiteDateRangePicker`; add no dependencies or duplicate time-control UI.
- Preserve an empty date selection, invalid-filter recovery, one-sided legacy URLs, status/search/order and pagination.
- Hourly windows use Asia/Bangkok, include their start and exclude their end; `24:00` means the end of each selected day.
- Invalid, incomplete or reversed times must fail before any history query.
- Add a migration; retain root-only service-role RPC access and compatibility with old callers.
- Verify the date/time controls, navigation, RPC payload, SQL boundaries and pagination.
- No Production deployment. Remote changes require the existing Staging workflow.

## Task 1: Validation, navigation and SQL filtering

- [x] Add failing validation, preserved-query and repository tests for `timeFrom`/`timeTo`.
- [x] Validate with the existing dashboard time parser and pass integer hour bounds to the RPC.
- [x] Add `20261029100000_login_history_time_filters.sql` replacing the list RPC with defaulted hourly arguments; filter before count/pagination.
- [x] Add isolated SQL tests covering Bangkok midnight, fractional seconds, recurring windows, ordering, counts and authorization.
- [x] Run targeted Node and isolated database tests.

## Task 2: Complete shared picker and verification

- [x] Add failing UI tests for hour controls, Apply navigation, empty selection and retained hours.
- [x] Allow an explicit null selection and validation attributes in the shared picker without changing dashboard defaults.
- [x] Replace the history picker composition with `WebsiteDateRangePicker`, using login-specific time-help text.
- [x] Update history documentation; regenerate the PWA artifact.
- [x] Run build, typecheck, lint, tests and review the final diff.

## Execution record

- Initial inspection: the first change reused only the calendar and presets. History's parser, URL allowlist and SQL function currently have no hourly filter.
- Docker CLI is present but its daemon is stopped; investigate local startup before SQL verification.
- Started Docker Desktop, then created only the documented isolated `webook-login-history-tests` container with no network or published ports. All four SQL suites and concurrent record/attach/purge checks passed.
- RED: three new validation/navigation/repository tests failed for missing hours; two UI tests failed for absent time controls. GREEN: all five pass after implementation.
- Local verification: build and typecheck passed; ESLint has no errors and 11 existing warnings. Node suite: 1,351 passed, four existing opt-in integration skips, zero failures.
- Independent whole-change review completed: no actionable findings in UI state/navigation, shared defaults, SQL boundaries, compatibility or authorization.
- Staging CI exposed a PostgreSQL startup race twice: socket readiness accepted the image's temporary init server, which stopped before the first psql call. The image entrypoint confirms that this server disables TCP. The readiness gate now checks loopback TCP, which becomes available only on the final server. The isolated fixture and test gate remain required.
- A separate CI attempt failed while starting the unchanged local Supabase integration fixture; sensitive CLI output remains suppressed.
