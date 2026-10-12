export type CalendarProvider = 'airbnb' | 'agoda' | 'booking_com' | 'other';
export interface ActiveCalendarEvent { uid: string; status: 'active'; start: string; endExclusive: string }
export interface CancelledCalendarEvent { uid: string; status: 'cancelled' }
export type CalendarEvent = ActiveCalendarEvent | CancelledCalendarEvent;
export interface CalendarSourceSummary {
  id: string; listing_id: string; provider: CalendarProvider; label: string; enabled: boolean;
  last_attempted_at: string | null; last_synced_at: string | null; next_refresh_at: string | null;
  last_error_code: string | null;
}
export interface CalendarSyncSummary { sources: CalendarSourceSummary[]; stale: boolean }
