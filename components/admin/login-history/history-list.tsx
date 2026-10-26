import { Laptop, Smartphone, Tablet } from "lucide-react";
import { LOCATION_STATUS_LABELS, type LoginHistoryEntry } from "../../../lib/login-history";
import { Badge } from "../../ui/badge";
import { Card, CardContent } from "../../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

const thaiTime=new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
function Device({entry}:{entry:LoginHistoryEntry}) {
  const Icon=entry.deviceType==="mobile"?Smartphone:entry.deviceType==="tablet"?Tablet:Laptop;
  return <div className="flex items-start gap-2"><Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground"/><div><p>{entry.browser} · {entry.os}</p><p className="text-xs text-muted-foreground">{entry.deviceType}</p></div></div>;
}
function Position({entry}:{entry:LoginHistoryEntry}) {
  return <div className="space-y-1"><Badge variant={entry.locationStatus==="success"?"secondary":"outline"}>{LOCATION_STATUS_LABELS[entry.locationStatus]}</Badge>
    {entry.locationStatus==="success" && entry.latitude!==null && entry.longitude!==null?<>
      <p className="text-sm tabular-nums">{entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}</p>
      <p className="text-xs text-muted-foreground">ความแม่นยำ ± {entry.accuracy?.toLocaleString("th-TH",{maximumFractionDigits:0})} เมตร</p>
    </>:null}</div>;
}
function Profile({entry}:{entry:LoginHistoryEntry}) {
  return <div><p className="font-medium">{entry.displayName || entry.username || "ไม่พบข้อมูลโปรไฟล์"}</p>{entry.email?<p className="break-all text-xs text-muted-foreground">{entry.email}</p>:null}</div>;
}
export function HistoryList({entries}:{entries:LoginHistoryEntry[]}) {
  if(entries.length===0)return <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">ไม่พบประวัติในช่วงที่เลือก</div>;
  return <>
    <div className="hidden rounded-xl border md:block"><Table>
      <TableHeader><TableRow><TableHead>ผู้ใช้</TableHead><TableHead>เวลาเข้าสู่ระบบ (ไทย)</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>IP</TableHead><TableHead>ตำแหน่ง</TableHead></TableRow></TableHeader>
      <TableBody>{entries.map(entry=><TableRow key={entry.id}>
        <TableCell><Profile entry={entry}/></TableCell><TableCell className="tabular-nums"><time dateTime={entry.loggedInAt}>{thaiTime.format(new Date(entry.loggedInAt))}</time></TableCell>
        <TableCell><Device entry={entry}/></TableCell><TableCell className="max-w-48 break-all whitespace-normal font-mono text-xs">{entry.ipAddress ?? "ไม่ทราบ"}</TableCell><TableCell><Position entry={entry}/></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div className="space-y-3 md:hidden">{entries.map(entry=><Card key={entry.id}><CardContent className="space-y-4 pt-4">
      <div className="space-y-1"><Profile entry={entry}/><time className="text-sm text-muted-foreground" dateTime={entry.loggedInAt}>{thaiTime.format(new Date(entry.loggedInAt))}</time></div>
      <Device entry={entry}/><p className="break-all text-xs text-muted-foreground">IP: {entry.ipAddress ?? "ไม่ทราบ"}</p><Position entry={entry}/>
    </CardContent></Card>)}</div>
  </>;
}
