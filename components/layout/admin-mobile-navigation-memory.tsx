"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createMobileNavigationMemory } from "../../lib/mobile-navigation";

const MemoryContext = createContext<ReturnType<typeof createMobileNavigationMemory> | null>(null);
const empty: Readonly<Record<string, string>> = {};
const emptySnapshot = () => empty;
const subscribeEmpty = () => () => {};

export function AdminMobileNavigationMemory({ children }: { children: ReactNode }) {
  const [memory] = useState(createMobileNavigationMemory);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => { memory.remember(pathname, search); }, [memory, pathname, search]);
  return <MemoryContext.Provider value={memory}>{children}</MemoryContext.Provider>;
}

export function useMobileNavigationLists() {
  const memory = useContext(MemoryContext);
  return useSyncExternalStore(memory?.subscribe ?? subscribeEmpty, memory?.getSnapshot ?? emptySnapshot, emptySnapshot);
}
