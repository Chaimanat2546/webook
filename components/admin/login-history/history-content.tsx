"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, History, RefreshCw, SearchX, TriangleAlert } from "lucide-react";
import type { HistoryView } from "../../../server/services/login-history-view";
import { historyHref, historyRangeLabel } from "../../../lib/login-history-view";
import { Button } from "../../ui/button";
import { HistoryList } from "./history-list";
import { HistorySkeleton } from "./history-skeleton";
import { useHistoryNavigation } from "./history-navigation";

export function HistoryContent({ view }: { view: HistoryView }) {
  const navigation = useHistoryNavigation();
  const { rememberRecords } = navigation;
  useEffect(() => { if (view.state === "records" && view.result) rememberRecords(view.result); }, [view.state,view.result,rememberRecords]);
  if (navigation.pending) return <HistorySkeleton />;
  const { state, result, params } = view;
  if (state === "invalid-date") return navigation.lastRecords ? <div className="space-y-3 pt-5"><p className="text-xs text-muted-foreground">รายการจากการค้นหาครั้งก่อน</p><HistoryList entries={navigation.lastRecords.entries} /></div> : null;
  if (state !== "records") {
    const Icon = state === "default-empty" ? History : state === "filtered-empty" ? SearchX : TriangleAlert;
    const message = state === "default-empty" ? "ยังไม่มีประวัติการเข้าสู่ระบบ" : state === "filtered-empty" ? "ไม่พบรายการที่ตรงกับตัวกรอง" : state === "invalid-filter" ? "ตัวกรองไม่ถูกต้อง กรุณาเลือกใหม่" : "โหลดประวัติไม่สำเร็จ";
    return <div className="mt-6 flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border bg-card px-5 py-10 text-center" role={state === "load-error" || state === "invalid-filter" ? "alert" : "status"}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Icon aria-hidden className={state === "load-error" || state === "invalid-filter" ? "size-6 text-destructive" : "size-6 text-muted-foreground"} /></div>
      <p className="text-sm font-medium">{message}</p>
      {state === "filtered-empty" || state === "invalid-filter" ? <Button variant="outline" onClick={() => navigation.navigate("/admin/login-history")}>ล้างตัวกรอง</Button> : state === "load-error" ? <Button variant="outline" onClick={navigation.retry}><RefreshCw aria-hidden className="size-4" />ลองใหม่</Button> : null}
    </div>;
  }
  if (!result) return null;
  const pages = Math.max(1,Math.ceil(result.total / result.pageSize));
  return <div className="space-y-4 pt-5" aria-live="polite">
    <HistoryList entries={result.entries} />
    <nav aria-label="หน้าประวัติการเข้าสู่ระบบ" className="flex items-center justify-between gap-2 rounded-3xl border bg-card px-3 py-2.5">
      <Button type="button" variant="ghost" size="sm" disabled={result.page <= 1} onClick={() => navigation.navigate(historyHref(params,{page:String(result.page-1)}))}><ChevronLeft aria-hidden className="size-4" />ก่อนหน้า</Button>
      <span className="text-xs text-muted-foreground">หน้า {result.page} / {pages}</span>
      <Button type="button" variant="ghost" size="sm" disabled={result.page >= pages} onClick={() => navigation.navigate(historyHref(params,{page:String(result.page+1)}))}>ถัดไป<ChevronRight aria-hidden className="size-4" /></Button>
    </nav>
    <p className="pb-4 text-center text-xs text-muted-foreground">{historyRangeLabel(result.page,result.pageSize,result.total,result.entries.length)}</p>
  </div>;
}
