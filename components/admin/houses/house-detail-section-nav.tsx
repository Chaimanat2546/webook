"use client";

import { BanknoteIcon, HouseIcon, SparklesIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { scrollActiveItemToStart } from "../../../lib/scroll-active-item";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";
import { HouseWorkspaceNavItem } from "./house-workspace-nav-item";

interface HouseDetailSection {
  readonly badge?: string;
  readonly key: string;
  readonly label: string;
}

interface HouseDetailSectionNavProps {
  propertyId: string;
  returnTo?: string | null;
  sections: readonly HouseDetailSection[];
  selectedSection: string;
}

const sectionIconByKey: Record<string, LucideIcon> = {
  details: HouseIcon,
  prices: BanknoteIcon,
  facilities: SparklesIcon,
};

function sectionHref(propertyId: string, section: string, returnTo?: string | null) {
  const params = new URLSearchParams({ section });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

export function HouseDetailSectionNav({
  propertyId,
  returnTo,
  sections,
  selectedSection,
}: HouseDetailSectionNavProps) {
  const activeSectionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const activeSection = activeSectionRef.current;
    if (!activeSection || !window.matchMedia("(max-width: 1023px)").matches) return;

    scrollActiveItemToStart(activeSection);
  }, [selectedSection]);

  return (
    <ScrollArea className="w-full min-w-0 lg:h-full">
      <nav
        aria-label="House detail sections"
        className="flex w-max min-w-full gap-2 p-2 lg:w-auto lg:min-w-0 lg:flex-col lg:p-3"
      >
        {sections.map((item) => {
          const isActive = item.key === selectedSection;
          const SectionIcon = sectionIconByKey[item.key] ?? HouseIcon;

          return (
            <HouseWorkspaceNavItem
              active={isActive}
              badge={item.badge}
              href={sectionHref(propertyId, item.key, returnTo)}
              icon={<SectionIcon aria-hidden className="size-4 shrink-0" />}
              key={item.key}
              label={item.label}
              ref={isActive ? activeSectionRef : undefined}
            />
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
