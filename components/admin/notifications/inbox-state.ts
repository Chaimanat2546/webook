import type { NotificationPage } from "../../../lib/booking-notifications";

export function notificationCountLabel(count: number | null): string | null {
  return count === null || count === 0 ? null : count > 99 ? "99+" : String(count);
}

export function shouldRefreshNotifications(visibility: string, online: boolean): boolean {
  return visibility === "visible" && online;
}

export function visibleNotificationPage(page: NotificationPage | null, actorId?: string): NotificationPage | null {
  return page && (!actorId || page.actorId === actorId) ? page : null;
}
