# Notification destinations

Approved scope: notification cards open internal booking details directly. Existing
Push URLs remain valid entry points, resolving destinations after authorization.
Imported calendar entries open the house calendar only with booking permission.

1. Reuse one destination helper in `lib/booking-notifications.ts`, preserving the
   dashboard's Bangkok `bookingUpdatedAt` month and `status=all` query.
2. Keep cards on the stable authorized resolver, which reads the current booking
   revision before choosing its report month. A feed-captured month can become
   stale across month boundaries. All cards forward automatically, with no summary.
3. Replace the old notification detail screen with a client forwarding state and
   fallback link. Reuse the visible-view read marker, then `router.replace` so
   history does not trap Back on a forwarding screen. GET/prefetch stays read-only.
4. Cover event destinations, calendar permissions, old URL authorization and
   client-only reading/forwarding. Run relevant tests, typecheck, lint and build.
5. Review and document the new flow. No migration or deployment is requested.
