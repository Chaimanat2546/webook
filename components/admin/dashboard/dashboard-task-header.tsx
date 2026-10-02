import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "../../ui/button";

interface DashboardTaskHeaderProps {
  backHref: string;
  backLabel: string;
  description: string;
  title: string;
}

export function DashboardTaskHeader({
  backHref,
  backLabel,
  description,
  title,
}: DashboardTaskHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-2">
      <Button asChild className="min-h-12 w-fit px-3 text-base md:min-h-0 md:px-0 md:text-sm" size="sm" variant="ghost">
        <Link href={backHref}>
          <ArrowLeftIcon data-icon="inline-start" />
          {backLabel}
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm font-medium text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
