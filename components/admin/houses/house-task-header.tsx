import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface HouseTaskHeaderProps {
  actions?: ReactNode;
  backHref: string;
  propertyId: string | number;
  subtitle: string;
  title: string;
}

export function HouseTaskHeader({
  actions,
  backHref,
  propertyId,
  subtitle,
  title,
}: HouseTaskHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between lg:pb-4">
      <div className="flex flex-col gap-2">
        <Button asChild className="w-fit px-0" size="sm" variant="ghost">
          <Link href={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            กลับไปบ้านพัก
          </Link>
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold sm:text-lg lg:text-xl">{title}</h1>
            <Badge variant="secondary">DV-{propertyId}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
