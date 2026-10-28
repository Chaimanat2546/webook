"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { HistoryPage } from "../../../lib/login-history";

interface HistoryNavigation { pending: boolean; navigate: (href: string) => void; retry: () => void; lastRecords: HistoryPage | null; rememberRecords: (records: HistoryPage) => void }
const Context = createContext<HistoryNavigation | null>(null);
export function HistoryNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lastRecords, setLastRecords] = useState<HistoryPage | null>(null);
  const rememberRecords = useCallback((records: HistoryPage) => setLastRecords(records),[]);
  return <Context value={{ pending, navigate: href => start(() => router.push(href)), retry: () => start(() => router.refresh()), lastRecords, rememberRecords }}>{children}</Context>;
}
export function useHistoryNavigation(): HistoryNavigation {
  const context = useContext(Context);
  if (!context) throw new Error("History navigation context missing");
  return context;
}
