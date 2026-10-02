import type { ReactNode } from "react";

interface DashboardDetailLayoutProps {
  children?: ReactNode;
  desktopContent?: ReactNode;
  desktopHeader?: ReactNode;
  desktopSummary?: ReactNode;
  mobileContent?: ReactNode;
  mobileHeader?: ReactNode;
  mobileSummary?: ReactNode;
  tabs?: ReactNode;
}

export function DashboardDetailLayout({
  children,
  desktopContent,
  desktopHeader,
  desktopSummary,
  mobileContent,
  mobileHeader,
  mobileSummary,
  tabs,
}: DashboardDetailLayoutProps) {
  if (children) return <div className="mx-auto min-w-0 max-w-7xl space-y-5">{children}</div>;
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5">
    <div className="space-y-4 lg:hidden">{mobileHeader}{mobileSummary}{tabs}{mobileContent}</div>
    <div className="hidden lg:block">{desktopHeader}{tabs}</div>
    <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="order-first">{desktopContent}</div>
      <div className="order-last">{desktopSummary}</div>
    </div>
  </div>;
}
