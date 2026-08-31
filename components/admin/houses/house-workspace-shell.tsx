import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";

interface HouseWorkspaceShellProps {
  children: ReactNode;
  contentActions?: ReactNode;
  contentClassName?: string;
  contentIcon: ReactNode;
  contentMeta?: ReactNode;
  contentTitle: ReactNode;
  sidebar: ReactNode;
  sidebarTitle: string;
}

export function HouseWorkspaceShell({
  children,
  contentActions,
  contentClassName,
  contentIcon,
  contentMeta,
  contentTitle,
  sidebar,
  sidebarTitle,
}: HouseWorkspaceShellProps) {
  return (
    <div className="grid overflow-hidden rounded-lg border lg:min-h-0 lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="hidden border-b px-4 py-3 lg:block">
          <h2 className="text-sm font-semibold">{sidebarTitle}</h2>
        </div>
        {sidebar}
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header
          className={cn(
            "border-b bg-muted/20 px-4 py-3",
            contentActions
              ? "flex flex-wrap items-center justify-between gap-3"
              : "hidden lg:flex lg:items-center lg:justify-between lg:gap-3",
          )}
        >
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
              {contentIcon}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{contentTitle}</h2>
              {contentMeta ? <p className="text-xs text-muted-foreground">{contentMeta}</p> : null}
            </div>
          </div>
          {contentActions ? (
            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
              {contentActions}
            </div>
          ) : null}
        </header>

        <div className={cn("p-4 lg:min-h-0 lg:overflow-y-auto", contentClassName)}>
          {children}
        </div>
      </section>
    </div>
  );
}
