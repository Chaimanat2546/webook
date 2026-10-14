"use client";

import { type FormEvent, useState } from "react";
import { ListFilterIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DASHBOARD_HOUSE_LIST_SORTS, type DashboardHousesQuery } from "../../../lib/dashboard";
import { dashboardHousesHref } from "../../../lib/dashboard-routes";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { ReportDateRangePicker } from "./report-date-range-picker";
import { DashboardListToolbar } from "./dashboard-list-toolbar";

export function DashboardHouseFilters({ query }: { query: DashboardHousesQuery }) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(dashboardHousesHref(query, { search: search.trim() }));
  }

  return <DashboardListToolbar onSubmit={submit}>
    <div className="relative w-full">
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="ค้นหาบ้าน" className="h-11 pl-9 pr-11" name="search" onChange={event => setSearch(event.target.value)} placeholder="ค้นหาบ้าน..." type="search" value={search} />
      <button aria-label="ค้นหา" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2" type="submit"><SearchIcon aria-hidden className="size-4" /></button>
    </div>
    <div className="w-full min-w-0 pb-1">
      <div className="flex w-full min-w-0 flex-wrap gap-2">
        <ReportDateRangePicker className="h-8 w-auto min-w-0 max-w-full flex-none text-sm" month={query.month} range={query.dateFrom && query.dateTo ? { from: query.dateFrom, to: query.dateTo } : undefined} onChange={range => router.push(dashboardHousesHref(query, { dateFrom: range.from, dateTo: range.to }))} />
        <Select items={DASHBOARD_HOUSE_LIST_SORTS} value={query.houseSort ?? "created-desc"} onValueChange={houseSort => { if (houseSort) router.push(dashboardHousesHref(query, { houseSort })); }}>
          <SelectTrigger id="house-sort" aria-label="เรียงลำดับบ้าน" className="min-w-0 w-auto max-w-full pl-3">
            <ListFilterIcon aria-hidden className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start"><SelectGroup>{DASHBOARD_HOUSE_LIST_SORTS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </div>
    </div>
  </DashboardListToolbar>;
}
