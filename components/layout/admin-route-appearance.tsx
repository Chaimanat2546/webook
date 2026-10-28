"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AdminRouteAppearance({ children }: { children: ReactNode }) {
  const history = usePathname() === "/admin/login-history";
  return <div className={history ? "audit-theme min-h-dvh bg-background text-foreground" : undefined}>{children}</div>;
}
