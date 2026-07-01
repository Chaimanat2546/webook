import { CircleAlert, CircleCheck, Info } from "lucide-react";

import { Alert, AlertDescription } from "../../components/ui/alert";

const styles = {
  error:
    "border-0 border-l-4 border-l-destructive bg-destructive/10 text-destructive [&_[data-slot=alert-description]]:text-destructive",
  info: "border-0 border-l-4 border-l-muted-foreground bg-muted/60",
  success:
    "border-0 border-l-4 border-l-emerald-600 bg-emerald-50 text-emerald-800 [&_[data-slot=alert-description]]:text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:[&_[data-slot=alert-description]]:text-emerald-300",
} as const;

const icons = {
  error: CircleAlert,
  info: Info,
  success: CircleCheck,
} as const;

export function AuthMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: keyof typeof styles;
}) {
  const Icon = icons[tone];

  return (
    <Alert className={styles[tone]} variant={tone === "error" ? "destructive" : "default"}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
