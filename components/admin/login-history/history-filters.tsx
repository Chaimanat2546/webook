"use client";

import Link from "next/link";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { ThaiDateRangePicker } from "../../ui/thai-date-range-picker";

function calendarDate(day:string|undefined):Date|undefined {
  if(!day)return undefined;
  const [year,month,date]=day.split("-").map(Number);
  return new Date(year,month-1,date);
}
function dayValue(date:Date|undefined):string {
  return date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`:"";
}
export function HistoryFilters({canSearchUsers,search,from,to}:{canSearchUsers:boolean;search:string;from?:string;to?:string}) {
  const [range,setRange]=useState<DateRange|undefined>(from||to?{from:calendarDate(from),to:calendarDate(to)}:undefined);
  return <form method="get" action="/admin/login-history" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
    {canSearchUsers?<div className="min-w-0 flex-1 space-y-2"><Label htmlFor="history-user-search">ผู้ใช้</Label><Input id="history-user-search" name="q" defaultValue={search} maxLength={200} placeholder="ชื่อ ชื่อผู้ใช้ หรืออีเมล"/></div>:null}
    <div className="min-w-0 flex-1 space-y-2"><p className="text-sm font-medium">วันที่เข้าสู่ระบบ (เวลาไทย)</p><ThaiDateRangePicker label="ช่วงวันที่เข้าสู่ระบบ" value={range} onChange={setRange}/></div>
    <input type="hidden" name="from" value={dayValue(range?.from)}/><input type="hidden" name="to" value={dayValue(range?.to)}/>
    <div className="flex gap-2"><Button type="submit" className="min-h-11 flex-1 sm:flex-none">ค้นหา</Button><Button asChild variant="outline" className="min-h-11"><Link href="/admin/login-history">ล้างตัวกรอง</Link></Button></div>
  </form>;
}
