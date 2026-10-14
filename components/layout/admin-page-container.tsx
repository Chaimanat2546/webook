import type { ReactNode } from "react";

/** Shared page width; outer AdminMobileContent owns responsive padding. */
export function AdminPageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-w-0 w-full max-w-7xl print:max-w-none">{children}</div>;
}
