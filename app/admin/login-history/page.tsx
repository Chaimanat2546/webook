import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { HistoryFilters } from "../../../components/admin/login-history/history-filters";
import { HistoryNavigationProvider } from "../../../components/admin/login-history/history-navigation";
import { HistoryContent } from "../../../components/admin/login-history/history-content";
import { Button } from "../../../components/ui/button";
import { LoginHistoryError } from "../../../lib/login-history";
import { loginHistorySession } from "../../../server/auth/login-history";
import { loadHistoryView, type HistoryView } from "../../../server/services/login-history-view";

export const dynamic = "force-dynamic";
export default async function LoginHistoryPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  let view: HistoryView;
  try {
    const { actor, repository } = await loginHistorySession();
    view = await loadHistoryView(repository,actor,query);
  } catch (error) {
    if (error instanceof LoginHistoryError && error.status === 401) redirect("/login?expired=1");
    view = { state:"load-error",params:Object.fromEntries(Object.entries(query).map(([key,value]) => [key,Array.isArray(value) ? value[0] : value])) };
  }
  if (view.state === "forbidden") return <section className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card px-5 py-10 text-center"><ShieldX aria-hidden className="mx-auto size-9 text-muted-foreground" /><h1 className="text-lg font-semibold">คุณไม่มีสิทธิ์ดูประวัติการเข้าสู่ระบบ</h1><Button asChild variant="outline"><Link href="/">กลับหน้าหลัก</Link></Button></section>;
  return <HistoryNavigationProvider><div className="mx-auto max-w-5xl">
    <header className="mb-4"><h1 className="text-xl font-semibold leading-snug">ประวัติการเข้าสู่ระบบ</h1><p className="mt-1 text-xs leading-relaxed text-muted-foreground">ตรวจสอบการเข้าสู่ระบบและข้อมูลตำแหน่ง · แสดงเวลาไทย</p></header>
    <HistoryFilters key={JSON.stringify(view.params)} params={view.params} dateError={view.state === "invalid-date"} />
    <HistoryContent view={view} />
  </div></HistoryNavigationProvider>;
}
