"use client";

import { BanknoteIcon, HouseIcon, SparklesIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { scrollActiveItemToStart } from "../../../lib/scroll-active-item";
import { cn } from "../../../lib/utils";
import { Badge } from "../../ui/badge";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

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
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-44 shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0 lg:justify-between lg:gap-3",
                isActive && "bg-primary text-primary-foreground hover:bg-primary",
              )}
              href={sectionHref(propertyId, item.key, returnTo)}
              key={item.key}
              ref={isActive ? activeSectionRef : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <SectionIcon aria-hidden className="size-4 shrink-0" />
                <span className="block min-w-0 truncate font-medium">{item.label}</span>
              </span>
              {item.badge ? (
                <Badge className="hidden shrink-0 lg:inline-flex" variant={isActive ? "secondary" : "outline"}>
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
