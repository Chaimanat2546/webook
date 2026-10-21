"use client";

import { ChartNoAxesCombined, ListChecks, ShieldPlus, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

export function DashboardMobileNavigation({ admin, websites }: { admin: boolean; websites: boolean }) {
  const [active, setActive] = useState("dashboard-business");
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-10% 0px -65% 0px" });
    document.querySelectorAll("[data-dashboard-section]").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const items = [
    { id: "dashboard-business", label: "สุขภาพธุรกิจ", icon: ShieldPlus },
    { id: "dashboard-trend", label: "เทรนด์จอง", icon: TrendingUp },
    ...(admin ? [{ id: "dashboard-operations", label: "ติดตามงาน", icon: ListChecks }] : []),
    ...(websites ? [{ id: "dashboard-websites", label: "เว็บไซต์", icon: ChartNoAxesCombined }] : []),
  ];
  return <nav aria-label="ส่วนต่าง ๆ ของ dashboard" className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t bg-background px-4 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] md:hidden print:hidden">
    {items.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setActive(id)} className={cn("flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring", active === id ? "bg-primary/10 text-primary" : "text-muted-foreground")}><Icon aria-hidden className="size-5" />{label}</a>)}
  </nav>;
}
