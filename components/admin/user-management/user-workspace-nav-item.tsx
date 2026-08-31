import Link from "next/link";
import type { ReactNode } from "react";
import { forwardRef } from "react";

import { cn } from "../../../lib/utils";

interface UserWorkspaceNavItemProps {
  active?: boolean;
  href: string;
  icon: ReactNode;
  label: ReactNode;
}

export const UserWorkspaceNavItem = forwardRef<HTMLAnchorElement, UserWorkspaceNavItemProps>(
  function UserWorkspaceNavItem({
    active = false,
    href,
    icon,
    label,
  }, ref) {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-44 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
          active && "bg-primary text-primary-foreground hover:bg-primary",
        )}
        href={href}
        ref={ref}
      >
        <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
        <span className="min-w-0 truncate font-medium">{label}</span>
      </Link>
    );
  },
);
