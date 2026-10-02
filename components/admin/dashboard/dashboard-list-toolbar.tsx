import type { FormEventHandler, ReactNode } from "react";

interface DashboardListToolbarProps {
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function DashboardListToolbar({ children, onSubmit }: DashboardListToolbarProps) {
  return <form className="mb-4 space-y-2" onSubmit={onSubmit}>{children}</form>;
}
