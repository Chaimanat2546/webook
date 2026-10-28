import { Ban, Clock3, History, Laptop, MapPin, MapPinOff, Smartphone, Tablet, TriangleAlert } from "lucide-react";
import { LOCATION_STATUS_LABELS, type LoginHistoryEntry } from "../../../lib/login-history";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

const thaiTime = new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const thaiDay = new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"long",year:"numeric"});
const dayKey = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"});
function DeviceIcon({ entry }: { entry: LoginHistoryEntry }) {
  const Icon = entry.deviceType === "mobile" ? Smartphone : entry.deviceType === "tablet" ? Tablet : Laptop;
  return <Icon aria-hidden className="size-4" />;
}
function Position({ entry }: { entry: LoginHistoryEntry }) {
  const status = entry.locationStatus;
  const Icon = status === "success" ? MapPin : status === "denied" ? Ban : status === "timeout" ? Clock3 : status === "unavailable" ? TriangleAlert : MapPinOff;
  const color = status === "success" ? "text-primary-text" : status === "denied" ? "text-destructive" : status === "unavailable" || status === "timeout" ? "text-amber-700" : "text-muted-foreground";
  return <div className={`flex items-start gap-1.5 text-xs leading-relaxed ${color}`}><Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" /><div className="min-w-0">
    <span>{LOCATION_STATUS_LABELS[status]}</span>
    {status === "success" && entry.latitude !== null && entry.longitude !== null ? <>
      <span className="break-words text-muted-foreground"> · {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}{entry.accuracy !== null ? ` · ±${entry.accuracy.toLocaleString("th-TH",{maximumFractionDigits:0})} เมตร` : ""}</span>
    </> : null}
  </div></div>;
}
function Profile({ entry }: { entry: LoginHistoryEntry }) {
  return <div className="min-w-0"><p className="break-words text-base font-semibold leading-snug">{entry.displayName || entry.username || "ไม่พบข้อมูลโปรไฟล์"}</p>{entry.email ? <p className="mt-0.5 break-all text-xs leading-relaxed text-muted-foreground">{entry.email}</p> : null}</div>;
}
export function HistoryList({ entries }: { entries: LoginHistoryEntry[] }) {
  const groups = new Map<string,LoginHistoryEntry[]>();
  for (const entry of entries) { const key = dayKey.format(new Date(entry.loggedInAt)); const group = groups.get(key) ?? [];group.push(entry);groups.set(key,group); }
  return <>
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block"><Table>
      <TableHeader><TableRow><TableHead>เวลาเข้าสู่ระบบ (ไทย)</TableHead><TableHead>ผู้ใช้</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>IP / ตำแหน่ง</TableHead></TableRow></TableHeader>
      <TableBody>{entries.map(entry => <TableRow key={entry.id}>
        <TableCell><time className="text-xs tabular-nums" dateTime={entry.loggedInAt}>{thaiDay.format(new Date(entry.loggedInAt))}<br />{thaiTime.format(new Date(entry.loggedInAt))}</time></TableCell>
        <TableCell className="max-w-56 whitespace-normal"><Profile entry={entry} /></TableCell>
        <TableCell><div className="flex items-center gap-2 text-primary-text"><DeviceIcon entry={entry} /><span className="text-xs text-foreground">{entry.browser} · {entry.os}</span></div><p className="mt-1 text-xs text-muted-foreground">{entry.deviceType}</p></TableCell>
        <TableCell className="max-w-72 whitespace-normal"><p className="mb-1 break-all font-mono text-xs text-muted-foreground">IP {entry.ipAddress ?? "ไม่ทราบ"}</p><Position entry={entry} /></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div className="space-y-6 md:hidden">{Array.from(groups,([key,group]) => <section key={key} aria-labelledby={`history-day-${key}`}>
      <div className="mb-3.5 flex items-center gap-2 text-muted-foreground"><History aria-hidden className="size-3.5" /><h2 id={`history-day-${key}`} className="text-xs font-medium">{thaiDay.format(new Date(group[0].loggedInAt))}</h2><span className="h-px flex-1 bg-border" /></div>
      <div className="space-y-3">{group.map(entry => <article key={entry.id} className="flex gap-3.5 rounded-3xl border bg-card p-4 shadow-[0_2px_7px_#20283A0a]">
        <div className="w-10 shrink-0 text-center"><time dateTime={entry.loggedInAt} className="text-sm font-bold tabular-nums">{thaiTime.format(new Date(entry.loggedInAt))}</time><div className="mx-auto mt-2 flex size-8 items-center justify-center rounded-full border border-border/40 bg-muted text-primary-text"><DeviceIcon entry={entry} /></div></div>
        <div className="min-w-0 flex-1 space-y-2"><div className="flex items-start justify-between gap-2"><Profile entry={entry} /><Badge className="shrink-0 rounded-lg border-primary/5 bg-muted px-1.5 text-[10px] text-muted-foreground" variant="outline">สำเร็จ</Badge></div>
          <p className="break-words text-xs leading-relaxed">{entry.browser} <span className="text-muted-foreground">·</span> {entry.os} <span className="text-muted-foreground">·</span> {entry.deviceType}</p>
          <div className="space-y-1.5 border-t border-background pt-2.5"><p className="break-all text-xs text-muted-foreground">IP <span className="ml-1 font-mono">{entry.ipAddress ?? "ไม่ทราบ"}</span></p><Position entry={entry} /></div>
        </div>
      </article>)}</div>
    </section>)}</div>
  </>;
}
