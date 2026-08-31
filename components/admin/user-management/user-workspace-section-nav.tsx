"use client";

import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { scrollActiveItemToStart } from "../../../lib/scroll-active-item";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";
import { UserWorkspaceNavItem } from "./user-workspace-nav-item";

const USER_EDIT_SECTIONS = [
  { key: "details", label: "ข้อมูลผู้ใช้", icon: UserRoundIcon },
  { key: "permissions", label: "สิทธิ์และการใช้งาน", icon: ShieldCheckIcon },
] as const;

export function UserWorkspaceSectionNav({
  returnTo,
  selectedSection,
  userId,
}: {
  returnTo: string;
  selectedSection: (typeof USER_EDIT_SECTIONS)[number]["key"];
  userId: string;
}) {
  const activeSectionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const activeSection = activeSectionRef.current;
    if (!activeSection || !window.matchMedia("(max-width: 1023px)").matches) return;

    scrollActiveItemToStart(activeSection);
  }, [selectedSection]);

  return (
    <ScrollArea className="w-full min-w-0 lg:h-full">
      <nav
        aria-label="หมวดข้อมูลผู้ใช้"
        className="flex w-max min-w-full gap-2 p-2 lg:w-auto lg:min-w-0 lg:flex-col lg:p-3"
      >
        {USER_EDIT_SECTIONS.map((section) => {
          const isActive = section.key === selectedSection;
          const SectionIcon = section.icon;
          const params = new URLSearchParams();
          params.set("returnTo", returnTo);
          if (section.key === "permissions") params.set("section", "permissions");

          return (
            <UserWorkspaceNavItem
              active={isActive}
              href={`/admin/users/${encodeURIComponent(userId)}?${params.toString()}`}
              icon={<SectionIcon aria-hidden />}
              key={section.key}
              label={section.label}
              ref={isActive ? activeSectionRef : undefined}
            />
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
