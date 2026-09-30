"use client";

import { useState } from "react";
import Link from "next/link";
import { dashboardMoney, type DashboardAgency, type DashboardSales } from "../../../lib/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface AgencySalesProps { agencies: DashboardAgency[]; sales: DashboardSales; month: string; }

export function AgencySales({ agencies, sales, month }: AgencySalesProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const matches = agencies.filter(row => row.name.toLocaleLowerCase("th").includes(search.trim().toLocaleLowerCase("th")));
  const pages = Math.max(1, Math.ceil(matches.length / 5));
  const current = Math.min(page, pages);
  return <Card id="agency-sales"><CardHeader><CardTitle><h2>ยอดขายเอเจนซี่</h2></CardTitle><CardDescription>แหล่งที่มาของยอดขาย · เฉพาะติดจอง · เรียงยอดขายสูงสุดก่อน</CardDescription></CardHeader><CardContent>
    {agencies.length === 0 ? <p className="py-6 text-center text-muted-foreground">ไม่มียอดขายติดจองในเดือนนี้</p> : <>
      {agencies.length > 5 && <Input className="mb-3" aria-label="ค้นหาเอเจนซี่" placeholder="ค้นหาชื่อเอเจนซี่" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />}
      <div className="divide-y">{matches.slice((current - 1) * 5, current * 5).map(row => {
        const share = sales.amountCents > 0 ? row.amountCents / sales.amountCents * 100 : 0;
        return <details key={row.id ?? "unassigned"} className="py-3"><summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><span className="min-w-0 break-words font-medium">{row.name}</span><span className="tabular-nums">{dashboardMoney(row.amountCents)}</span></div><p className="mt-1 text-xs text-muted-foreground">{row.count.toLocaleString("th-TH")} การจอง · {share.toFixed(1)}% ของยอดขาย · ดูรายละเอียด</p><div aria-hidden className="mt-2 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} /></div></summary><div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3 text-sm">{row.missingPrices > 0 && <p>ยังไม่ระบุราคา {row.missingPrices} รายการ</p>}<Link className="underline" href={`/admin/dashboard?${new URLSearchParams({ month, status: "confirmed", agency: row.id ?? "unassigned" })}#bookings`}>ดูการจองและบ้านที่สร้างยอดขายนี้</Link></div></details>;
      })}</div>
      {matches.length === 0 && <p className="py-4 text-sm text-muted-foreground">ไม่พบเอเจนซี่</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite"><span>{matches.length} เอเจนซี่ · หน้า {current} / {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</Button><Button size="sm" variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>ถัดไป</Button></div></div><p className="mt-3 text-xs text-muted-foreground">รวม {dashboardMoney(sales.amountCents)} · รวมรายการไม่ระบุเอเจนซี่และเอเจนซี่ที่ปิดใช้งาน</p>
    </>}
  </CardContent></Card>;
}
