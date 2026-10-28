"use client";
import { useSearchParams } from "next/navigation";
import { HistoryFilters } from "../../../components/admin/login-history/history-filters";
import { HistoryNavigationProvider } from "../../../components/admin/login-history/history-navigation";
import { HistorySkeleton } from "../../../components/admin/login-history/history-skeleton";

export default function LoadingHistory() {
  const params = useSearchParams();
  return <HistoryNavigationProvider><div className="mx-auto max-w-5xl"><header className="mb-4"><h1 className="text-xl font-semibold">ประวัติการเข้าสู่ระบบ</h1><p className="mt-1 text-xs text-muted-foreground">ตรวจสอบการเข้าสู่ระบบและข้อมูลตำแหน่ง · แสดงเวลาไทย</p></header><HistoryFilters params={Object.fromEntries(params.entries())} disabled /><HistorySkeleton /></div></HistoryNavigationProvider>;
}
