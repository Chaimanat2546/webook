"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps } from "react";

const DirtyContext = createContext<{
  dirty: boolean;
  markDirty: () => void;
  markSaved: () => void;
} | null>(null);

export function QuotationSettingsDirtyProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const value = useMemo(() => ({
    dirty,
    markDirty: () => setDirty(true),
    markSaved: () => setDirty(false),
  }), [dirty]);

  return <DirtyContext.Provider value={value}>{children}</DirtyContext.Provider>;
}

export function useQuotationSettingsDirty() {
  const value = useContext(DirtyContext);
  if (!value) throw new Error("Quotation settings dirty context is missing");
  return value;
}

export function QuotationSettingsNavLink({ current = false, onClick, ...props }: ComponentProps<typeof Link> & { current?: boolean }) {
  const { dirty } = useQuotationSettingsDirty();

  return <Link
    {...props}
    aria-current={current ? "page" : undefined}
    onClick={(event) => {
      onClick?.(event);
      if (event.defaultPrevented || current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (dirty && !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากส่วนนี้หรือไม่")) event.preventDefault();
    }}
  />;
}
