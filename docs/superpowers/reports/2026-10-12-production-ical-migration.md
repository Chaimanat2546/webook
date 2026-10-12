# Production iCal migration — 2026-10-12

- User explicitly requested and confirmed applying only `20261009120000_ical_booking_import.sql` to Production Supabase `https://rqizfiayvcbozlzuvbok.supabase.co`.
- Verified the linked project reference before applying. Read-only migration list and `db push --linked --dry-run` both identified exactly this one pending migration.
- Reviewed the SQL: adds calendar sources with server-only access, booking source identity fields, overlap constraint/booking guard, snapshot RPCs, and internal-only dashboard reporting filter. It runs inside a transaction. Backup status was not independently verified and this limitation was disclosed before confirmation.
- Ran `npx supabase db push --linked`: exit 0, migration applied.
- Follow-up remote migration list contains `20261009120000` in both Local and Remote; follow-up dry-run reports `Remote database is up to date`.
- CLI warned that the local pg-delta catalog cache could not be exported because Docker Desktop's Linux engine was unavailable. This occurred after applying the migration; remote history and follow-up dry-run verified completion.
- No Production Worker deployment, seed import, or calendar source/feed import was performed.
