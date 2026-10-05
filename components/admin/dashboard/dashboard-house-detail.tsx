/* eslint-disable @next/next/no-img-element -- image URLs are already allowlisted by the server-side storage adapter. */
import Link from "next/link";
import { BedDoubleIcon, Clock3Icon, ImageIcon, MapPinIcon, ShieldCheckIcon, SparklesIcon, UsersRoundIcon, WavesIcon } from "lucide-react";

import { dashboardDate, dashboardMoney, type DashboardHouseDetail, type DashboardQuery } from "../../../lib/dashboard";
import { dashboardHouseDetailHref } from "../../../lib/dashboard-routes";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardTaskHeader } from "./dashboard-task-header";

interface DashboardHouseDetailViewProps {
  backHref: string;
  backLabel: string;
  detail: DashboardHouseDetail;
  query: DashboardQuery;
}

const weekday = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

function houseType(value: string | null): string {
  if (value === "poolvilla") return "พูลวิลล่า";
  if (value === "condo") return "คอนโด";
  return value ?? "ไม่ระบุประเภท";
}

function time(value: string | null): string {
  return value?.slice(0, 5) ?? "—";
}

function Fact({ icon: Icon, label, value }: { icon: typeof BedDoubleIcon; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-3 px-1 py-2"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon aria-hidden className="size-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold">{value}</p></div></div>;
}

function HouseGallery({ detail }: { detail: DashboardHouseDetail }) {
  const images = detail.data.images;
  const cover = images.find(image => image.isCover) ?? images[0];
  if (!cover) return <Card className="min-h-56 border-dashed"><CardContent className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground"><span><ImageIcon aria-hidden className="mx-auto mb-2 size-8" />ยังไม่มีรูปภาพบ้าน</span></CardContent></Card>;
  return <section aria-label="แกลเลอรีรูปภาพ" className="space-y-2"><div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted"><img alt={`รูปบ้าน ${detail.data.title}`} className="size-full object-cover" src={cover.url} /><Badge className="absolute bottom-3 right-3" variant="secondary">{images.length} รูป</Badge></div>{images.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1">{images.slice(0, 6).map(image => <img alt="" aria-hidden className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10" key={image.id} src={image.url} />)}</div>}</section>;
}

function EmptyCard({ children, title }: { children: string; title: string }) {
  return <Card size="sm"><CardHeader className="border-b"><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="py-4 text-sm text-muted-foreground">{children}</p></CardContent></Card>;
}

export function DashboardHouseDetailView({ backHref, backLabel, detail, query }: DashboardHouseDetailViewProps) {
  const { data, house } = detail;
  const returnTo = dashboardHouseDetailHref({ month: query.month, search: query.houseSearch, page: query.housesPage }, house.id);
  const manageHref = data.propertyId ? `/admin/houses/${encodeURIComponent(data.propertyId)}?returnTo=${encodeURIComponent(returnTo)}` : null;
  const active = data.isActive ?? house.isActive;
  return <div className="mx-auto min-w-0 max-w-7xl space-y-5">
    <DashboardTaskHeader backHref={backHref} backLabel={backLabel} description="รายละเอียดบ้านใหม่" title={data.title} />
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
      <HouseGallery detail={detail} />
      <div className="space-y-4"><div className="space-y-3"><Badge variant={active ? "secondary" : "outline"}>{active === null ? "ไม่ระบุสถานะ" : active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge><div><p className="text-sm text-muted-foreground">DV-{data.propertyId ?? "ไม่ระบุ"}</p><h2 className="text-2xl font-semibold tracking-tight">{data.title}</h2></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPinIcon aria-hidden className="size-4" />{data.locationZone ?? "ไม่ระบุโซน"}</span><span>{houseType(data.propertyType)}</span></div>{data.description && <p className="text-sm leading-6 text-muted-foreground">{data.description}</p>}{data.propertyTags.length > 0 && <div className="flex flex-wrap gap-2">{data.propertyTags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>}</div>{manageHref && <Button asChild variant="outline"><Link href={manageHref}>จัดการบ้าน</Link></Button>}</div>
    </section>
    <Card size="sm"><CardContent className="grid gap-x-4 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5"><Fact icon={BedDoubleIcon} label="ห้องนอน" value={data.bedrooms === null ? "—" : `${data.bedrooms} ห้อง`} /><Fact icon={WavesIcon} label="ห้องน้ำ" value={data.bathrooms === null ? "—" : `${data.bathrooms} ห้อง`} /><Fact icon={UsersRoundIcon} label="รองรับสูงสุด" value={data.maxGuests === null ? "—" : `${data.maxGuests} คน`} /><Fact icon={Clock3Icon} label="เช็กอิน" value={time(data.checkinTime)} /><Fact icon={Clock3Icon} label="เช็กเอาต์" value={time(data.checkoutTime)} /></CardContent></Card>
    <section className="grid gap-4 lg:grid-cols-3">
      {data.prices.length === 0 ? <EmptyCard title="ราคา">ยังไม่ได้กำหนดราคา</EmptyCard> : <Card size="sm"><CardHeader className="border-b"><CardTitle>ราคา</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>วัน</TableHead><TableHead className="text-right">De Ville</TableHead><TableHead className="text-right">เอเจนซี</TableHead></TableRow></TableHeader><TableBody>{data.prices.map(price => <TableRow key={price.dayOfWeek ?? "unknown"}><TableCell>{price.dayOfWeek === null ? "ไม่ระบุ" : weekday[price.dayOfWeek] ?? "ไม่ระบุ"}{price.baseGuests !== null && <span className="block text-xs text-muted-foreground">{price.baseGuests} คน</span>}{price.note && <span className="block text-xs text-muted-foreground">{price.note}</span>}</TableCell><TableCell className="text-right">{price.devillePrice === null ? "—" : dashboardMoney(price.devillePrice * 100)}</TableCell><TableCell className="text-right">{price.agencyPrice === null ? "—" : dashboardMoney(price.agencyPrice * 100)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
      {data.facilities.length === 0 ? <EmptyCard title="สิ่งอำนวยความสะดวก">ยังไม่มีสิ่งอำนวยความสะดวกที่เปิดใช้งาน</EmptyCard> : <Card size="sm"><CardHeader className="border-b"><CardTitle>สิ่งอำนวยความสะดวก</CardTitle></CardHeader><CardContent><ul className="divide-y">{data.facilities.map(facility => <li className="flex items-start gap-3 py-3 text-sm" key={facility.id}><SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /><span><strong className="font-medium">{facility.title ?? facility.name ?? "ไม่ระบุ"}</strong>{facility.message && <span className="block text-muted-foreground">{facility.message}</span>}</span></li>)}</ul></CardContent></Card>}
      <Card size="sm"><CardHeader className="border-b"><CardTitle>ข้อมูลจัดการ</CardTitle></CardHeader><CardContent><dl className="divide-y text-sm"><div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">วันที่สร้าง</dt><dd>{dashboardDate(data.createdAt, true)}</dd></div>{data.updatedAt && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">อัปเดตล่าสุด</dt><dd>{dashboardDate(data.updatedAt, true)}</dd></div>}{data.insuranceFee !== null && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">ค่าประกัน</dt><dd>{dashboardMoney(data.insuranceFee * 100)}</dd></div>}{data.extraBedPrice !== null && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">ราคาเตียงเสริม</dt><dd>{dashboardMoney(data.extraBedPrice * 100)}</dd></div>}{data.sortOrder !== null && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">ลำดับแสดง</dt><dd>{data.sortOrder}</dd></div>}</dl></CardContent></Card>
    </section>
    {data.notes && <Card className="bg-primary/5" size="sm"><CardHeader><CardTitle className="inline-flex items-center gap-2"><ShieldCheckIcon aria-hidden className="size-4" />โน้ตภายใน</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm">{data.notes}</p></CardContent></Card>}
  </div>;
}
