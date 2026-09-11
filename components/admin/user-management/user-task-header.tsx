import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface UserTaskHeaderProps {
  backHref: string;
  dvId: string | null | undefined;
  subtitle: string;
  title: string;
}

export function UserTaskHeader({
  backHref,
  dvId,
  subtitle,
  title,
}: UserTaskHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between lg:pb-4">
      <div className="flex flex-col gap-2">
        <Button asChild className="min-h-12 w-fit px-3 text-base md:min-h-0 md:px-0 md:text-sm" size="sm" variant="ghost">
          <Link href={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            กลับไปรายการผู้ใช้
          </Link>
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold sm:text-lg lg:text-xl">{title}</h1>
            {dvId ? <Badge variant="secondary">DV-{dvId}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
