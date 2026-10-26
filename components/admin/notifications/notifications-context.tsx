"use client";

import { createContext, useContext } from "react";
import type { NotificationFilter, NotificationFeedPage } from "../../../lib/booking-notifications";

export interface NotificationsContextValue {
  data: NotificationFeedPage | null;
  observedAt: string | null;
  actorId: string | null;
  loading: boolean;
  error: string | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  loadingMore: boolean;
  loadMoreError: string | null;
  loadMore: () => Promise<void>;
  acceptNew: () => Promise<boolean>;
  filter: NotificationFilter;
  setFilter: (value: NotificationFilter) => void;
  refresh: () => Promise<void>;
  markRead: (input: { id: string } | { before: string }) => Promise<boolean>;
  cleanupDevice: () => Promise<boolean>;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
export function useNotifications() { return useContext(NotificationsContext); }
