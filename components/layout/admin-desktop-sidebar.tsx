"use client";

import {
  HouseIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export function AdminDesktopSidebar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-background p-3 transition-[width] md:flex md:flex-col",
        collapsed ? "w-16" : "w-44",
      )}
    >
      <div
        className={cn(
          "mb-6 flex items-center gap-2",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && <p className="text-sm font-semibold">VillaAdmin</p>}
        <Button
          aria-expanded={!collapsed}
          aria-label={collapsed ? "ขยายเมนูด้านข้าง" : "ย่อเมนูด้านข้าง"}
          onClick={() => setCollapsed((value) => !value)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
        </Button>
      </div>

      <nav className="flex flex-col gap-1">
        <Button
          asChild
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          title="บ้านพัก"
          variant="secondary"
        >
          <Link href="/admin/houses">
            <HouseIcon data-icon="inline-start" />
            <span className={cn(collapsed && "sr-only")}>บ้านพัก</span>
          </Link>
        </Button>
      </nav>

      <form action={signOutAction} className="mt-6">
        <Button
          className={cn("w-full", collapsed ? "px-0" : "justify-start")}
          title="ออกจากระบบ"
          type="submit"
          variant="outline"
        >
          <LogOutIcon data-icon="inline-start" />
          <span className={cn(collapsed && "sr-only")}>ออกจากระบบ</span>
        </Button>
      </form>
    </aside>
  );
}
