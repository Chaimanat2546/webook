import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";
import { HistoryList } from "../../../components/admin/login-history/history-list";
import { HistoryFilters } from "../../../components/admin/login-history/history-filters";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { parseHistoryFilter, LoginHistoryError } from "../../../lib/login-history";
import { loginHistorySession } from "../../../server/auth/login-history";
import { listLoginHistory } from "../../../server/services/login-history";

export const dynamic="force-dynamic";
async function loadHistory(query:Record<string,string|string[]|undefined>) {
  try {
    const session=await loginHistorySession();
    if(Object.values(query).some(Array.isArray))throw new LoginHistoryError(400);
    const params=query as Record<string,string|undefined>;
    const filter=parseHistoryFilter(params);
    const scope=await session.repository.scope(session.actor);
    const result=await listLoginHistory(session.repository,scope,filter);
    return {params,filter,scope,result};
  } catch(error) {
    if(error instanceof LoginHistoryError && error.status===401)redirect("/login");
    const message=error instanceof LoginHistoryError && error.status===400?"ตัวกรองไม่ถูกต้อง กรุณาตรวจช่วงวันที่และเลขหน้า":error instanceof LoginHistoryError && error.status===403?"คุณดูได้เฉพาะประวัติของตนเอง":"ยังโหลดประวัติไม่ได้ กรุณาลองใหม่ภายหลัง";
    return {error:message};
  }
}
export default async function LoginHistoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const data=await loadHistory(await searchParams);
  if("error" in data)return <div className="space-y-4"><h1 className="text-xl font-semibold">ประวัติการเข้าสู่ระบบ</h1><Alert variant="destructive"><AlertDescription>{data.error}</AlertDescription></Alert><Link className="text-sm underline" href="/admin/login-history">กลับหน้าประวัติ</Link></div>;
  const {params,filter,scope,result}=data;
  return <div className="space-y-5">
      <header className="flex items-start gap-3"><History aria-hidden className="mt-1 size-6 shrink-0 text-primary"/><div><h1 className="text-xl font-semibold">ประวัติการเข้าสู่ระบบ</h1><p className="mt-1 text-sm text-muted-foreground">{scope.kind==="root-admin"?"ประวัติผู้ใช้ใน WeBooks":"ประวัติของคุณ"} · แสดงเวลาไทย · เก็บข้อมูล 90 วัน</p></div></header>
      <HistoryFilters key={`${params.q ?? ""}|${params.from ?? ""}|${params.to ?? ""}`} canSearchUsers={scope.kind==="root-admin"} search={filter.search} from={params.from} to={params.to}/>
      <p className="text-sm text-muted-foreground" aria-live="polite">พบ {result.total.toLocaleString("th-TH")} รายการ</p>
      <HistoryList entries={result.entries}/>
      <Pagination basePath="/admin/login-history" currentPage={result.page} totalPages={Math.max(1,Math.ceil(result.total/result.pageSize))} search={filter.search} query={{...(params.from?{from:params.from}:{}),...(params.to?{to:params.to}:{}),...(filter.pageSize!==25?{pageSize:String(filter.pageSize)}:{})}}/>
    </div>;
}
