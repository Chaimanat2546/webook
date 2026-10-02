import { CalendarDaysIcon, SearchIcon } from "lucide-react";
import { Input } from "../../ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../ui/pagination";

export function DashboardMonthFilter({ id, month, width = "full" }: { id: string; month: string; width?: "full" | "half" }) {
  const layout = width === "half" ? "col-span-1" : "col-span-2";
  return <div className={`relative ${layout} min-w-0 sm:col-span-1 sm:w-48`}>
    <label className="sr-only" htmlFor={id}>เดือน</label>
    <CalendarDaysIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input id={id} className="h-11 pl-9" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} required />
  </div>;
}

export function DashboardSearchFilter({ ariaLabel, name, placeholder, value }: { ariaLabel: string; name: string; placeholder: string; value: string }) {
  return <div className="relative col-span-2 min-w-0 sm:col-span-1 sm:flex-1 sm:max-w-sm">
    <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input className="h-11 pl-9" aria-label={ariaLabel} name={name} defaultValue={value} placeholder={placeholder} type="search" />
  </div>;
}

export function DashboardPager({ page, pages, total, href, pageSize = 10 }: { page: number; pages: number; total: number; href: (next: number) => string; pageSize?: number }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
    <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} จาก ${total} รายการ` : "0 รายการ"}</span>
    <Pagination className="mx-0 w-auto" aria-label="แบ่งหน้ารายการ"><PaginationContent>
      {page > 1 && <PaginationItem><PaginationPrevious className="min-h-11 min-w-11" text="ก่อนหน้า" aria-label="หน้าก่อนหน้า" href={href(page - 1)} /></PaginationItem>}
      <PaginationItem><span className="px-2" aria-current="page">{page} / {pages}</span></PaginationItem>
      {page < pages && <PaginationItem><PaginationNext className="min-h-11 min-w-11" text="ถัดไป" aria-label="หน้าถัดไป" href={href(page + 1)} /></PaginationItem>}
    </PaginationContent></Pagination>
  </div>;
}
