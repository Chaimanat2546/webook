import {
  ClockIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "../../../lib/utils";
import type { AdvertisementRow } from "../../../server/repositories/advertisements";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../ui/empty";
import { Input } from "../../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600",
      )}
      variant="outline"
    >
      {active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH");
}

export function AdvertisementList({
  advertisements,
  search = "",
}: {
  advertisements: AdvertisementRow[];
  search?: string;
}) {
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button asChild>
          <Link href="/admin/advertisements/new">
            <PlusIcon data-icon="inline-start" />
            สร้างโฆษณา
          </Link>
        </Button>
      </div>

      <Card className="mb-4 p-3">
        <form className="flex gap-2">
          <div className="relative flex-1 md:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              defaultValue={search}
              name="q"
              placeholder="ค้นหาโฆษณา, ID..."
              type="search"
            />
          </div>
          <Button aria-label="ค้นหา" size="icon" type="submit" variant="outline">
            <SlidersHorizontalIcon />
          </Button>
        </form>
      </Card>

      {advertisements.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>ไม่พบโฆษณาที่ค้นหา</EmptyTitle>
            <EmptyDescription>ลองเปลี่ยนคำค้นหา หรือสร้างโฆษณาใหม่</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {advertisements.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {advertisements.map((advertisement) => (
              <Card
                className={cn(
                  "border-l-4",
                  advertisement.is_active ? "border-l-emerald-500" : "border-l-slate-300 opacity-70",
                )}
                key={advertisement.id}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      {advertisement.id.slice(0, 8)}
                    </p>
                    <CardTitle className="truncate text-lg">{advertisement.title}</CardTitle>
                  </div>
                  <StatusBadge active={advertisement.is_active} />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <ImageIcon className="size-4" />
                        รูปภาพ
                      </dt>
                      <dd className="font-medium text-foreground">
                        {advertisement.advertisement_images?.length ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <ClockIcon className="size-4" />
                        อัปเดต
                      </dt>
                      <dd className="font-medium text-foreground">{formatDate(advertisement.updated_at)}</dd>
                    </div>
                  </dl>
                  <Button asChild className="w-full">
                    <Link href={`/admin/advertisements/${encodeURIComponent(advertisement.id)}`}>
                      <SettingsIcon data-icon="inline-start" />
                      จัดการ
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อโฆษณา</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>จำนวนรูป</TableHead>
                  <TableHead>อัปเดตล่าสุด</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertisements.map((advertisement) => (
                  <TableRow className={advertisement.is_active ? "" : "opacity-70"} key={advertisement.id}>
                    <TableCell className="font-medium">{advertisement.title}</TableCell>
                    <TableCell>
                      <StatusBadge active={advertisement.is_active} />
                    </TableCell>
                    <TableCell>{advertisement.advertisement_images?.length ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(advertisement.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/advertisements/${encodeURIComponent(advertisement.id)}`}>จัดการ</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
    </>
  );
}
