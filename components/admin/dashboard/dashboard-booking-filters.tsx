"use client";

import { type FormEvent, useState } from "react";
import { ChevronDownIcon, ListFilterIcon, SearchIcon, TagIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DASHBOARD_BOOKING_SORTS, DASHBOARD_STATUSES, type DashboardBookingsQuery } from "../../../lib/dashboard";
import { dashboardBookingsHref } from "../../../lib/dashboard-routes";
import { Input } from "../../ui/input";
import { ThaiMonthPicker } from "../../ui/thai-month-picker";

interface DashboardBookingFiltersProps {
  query: DashboardBookingsQuery;
}

export function DashboardBookingFilters({ query }: DashboardBookingFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const navigate = (changes: Partial<DashboardBookingsQuery>) => router.push(dashboardBookingsHref(query, changes));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ search: search.trim() });
  }

  return <form className="mb-4 space-y-2" onSubmit={submit}>
    <div className="relative w-full">
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" className="h-11 pl-9 pr-11" name="search" onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" type="search" value={search} />
      <button aria-label="ค้นหา" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2" type="submit"><SearchIcon aria-hidden className="size-4" /></button>
    </div>
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
        <ThaiMonthPicker month={query.month} onMonthChange={month => navigate({ month })} />
        <div className="relative">
          <TagIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="booking-status">สถานะการจอง</label>
          <select id="booking-status" name="status" onChange={event => navigate({ status: event.target.value })} value={query.status} className="h-11 min-w-36 appearance-none rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus-visible:outline-2">
            <option value="all">ทุกสถานะ</option>
            {DASHBOARD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <ListFilterIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="booking-sort">เรียงลำดับ</label>
          <select id="booking-sort" name="sort" onChange={event => navigate({ sort: event.target.value as DashboardBookingsQuery["sort"] })} value={query.sort} className="h-11 min-w-44 appearance-none rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus-visible:outline-2">
            {DASHBOARD_BOOKING_SORTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </div>
  </form>;
}
