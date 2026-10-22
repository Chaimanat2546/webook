"use client";

import { createContext, useContext } from "react";
import type { NotificationPage } from "../../../lib/booking-notifications";

export interface NotificationsContextValue {
  data: NotificationPage | null;
  actorId: string | null;
  loading: boolean;
  error: string | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  page: number;
  setPage: (value: number) => void;
  refresh: () => Promise<void>;
  markRead: (input: { id: string } | { before: string }) => Promise<boolean>;
  cleanupDevice: () => Promise<boolean>;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
export function useNotifications() { return useContext(NotificationsContext); }
