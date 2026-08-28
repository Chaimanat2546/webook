import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

interface UserWorkspaceShellProps {
  children: ReactNode;
  contentIcon: ReactNode;
  contentTitle: ReactNode;
  sidebar: ReactNode;
  sidebarTitle: string;
}

export function UserWorkspaceShell({
  children,
  contentIcon,
  contentTitle,
  sidebar,
  sidebarTitle,
}: UserWorkspaceShellProps) {
  return (
    <div className="grid overflow-hidden rounded-lg border lg:min-h-0 lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="hidden border-b px-4 py-3 lg:block">
          <h2 className="text-sm font-semibold">{sidebarTitle}</h2>
        </div>
        {sidebar}
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="border-b bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
              {contentIcon}
            </span>
            <h2 className="truncate text-base font-semibold">{contentTitle}</h2>
          </div>
        </header>
        <div className={cn("p-4 lg:min-h-0 lg:overflow-y-auto")}>{children}</div>
      </section>
    </div>
  );
}
