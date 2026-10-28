import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className="audit-theme min-h-dvh bg-background text-foreground">{children}</div>;
}
