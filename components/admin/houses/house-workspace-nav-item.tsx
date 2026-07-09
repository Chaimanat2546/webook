"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";

import { cn } from "../../../lib/utils";
import { Badge } from "../../ui/badge";

interface HouseWorkspaceNavItemProps
  extends Omit<ComponentProps<typeof Link>, "children" | "className"> {
  active?: boolean;
  badge?: ReactNode;
  className?: string;
  icon: ReactNode;
  label: ReactNode;
}

export const HouseWorkspaceNavItem = forwardRef<HTMLAnchorElement, HouseWorkspaceNavItemProps>(
  function HouseWorkspaceNavItem(
    { active = false, badge, className, icon, label, ...props },
    ref,
  ) {
    return (
      <Link
        {...props}
        aria-current={active ? "page" : props["aria-current"]}
        className={cn(
          "flex min-w-44 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
          active && "bg-primary text-primary-foreground hover:bg-primary",
          className,
        )}
        ref={ref}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
            {icon}
          </span>
          <span className="block min-w-0 truncate font-medium">{label}</span>
        </span>
        {badge ? (
          <Badge className="hidden shrink-0 lg:inline-flex" variant={active ? "secondary" : "outline"}>
            {badge}
          </Badge>
        ) : null}
      </Link>
    );
  },
);
