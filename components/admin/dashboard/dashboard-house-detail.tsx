"use client";

/* eslint-disable @next/next/no-img-element -- image URLs are allowlisted by the server-side storage adapter. */
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftIcon,
  BathIcon,
  BadgeDollarSignIcon,
  BedDoubleIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CircleUserRoundIcon,
  StarIcon,
  ImageIcon,
  FileTextIcon,
  HouseIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";

import { dashboardDate, dashboardMoney, HOUSE_RATING_OPTIONS, type DashboardHouseDetail, type DashboardQuery } from "../../../lib/dashboard";
import { dashboardHouseDetailHref } from "../../../lib/dashboard-routes";
import { formatZone } from "../../../lib/house-zones";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Table, TableBody, TableCell, TableRow } from "../../ui/table";
import { FacilityIcon } from "../houses/facility-icon";

interface DashboardHouseDetailViewProps {
  backHref: string;
  backLabel: string;
  detail: DashboardHouseDetail;
  houseDetailReturnTo?: string;
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

function managementHref(propertyId: string, returnTo: string, section: "details" | "prices" | "facilities" = "details") {
  const params = new URLSearchParams({ section, returnTo });
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

function Fact({ icon: Icon, label, value }: { icon: typeof BedDoubleIcon; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-3 px-2 py-2"><Icon aria-hidden className="size-6 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold">{value}</p></div></div>;
}

function HouseGallery({ detail, imagesHref }: { detail: DashboardHouseDetail; imagesHref: string | null }) {
  const images = [...detail.data.images].sort((left, right) => Number(right.zone === "cover") - Number(left.zone === "cover") || left.order - right.order);
  const totalImageCount = detail.data.imageCount ?? images.length;
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const coverZoneIndex = images.findIndex(image => image.zone === "cover");
    return coverZoneIndex >= 0 ? coverZoneIndex : Math.max(0, images.findIndex(image => image.isCover));
  });
  const image = images[selectedIndex];
  if (!image) return <Card className="min-h-56 border-dashed"><CardContent className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground"><span><ImageIcon aria-hidden className="mx-auto mb-2 size-8" />ยังไม่มีรูปภาพบ้าน</span></CardContent></Card>;
  const select = (index: number) => setSelectedIndex((index + images.length) % images.length);
  return <section aria-label="แกลเลอรีรูปภาพ" className="min-w-0 space-y-2"><div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted"><img alt={`รูปบ้าน ${detail.data.title} ภาพที่ ${selectedIndex + 1}`} className="size-full object-cover" src={image.url} />{images.length > 1 && <><Button aria-label="ดูภาพก่อนหน้า" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90" onClick={() => select(selectedIndex - 1)} size="icon" variant="outline"><ChevronLeftIcon aria-hidden /></Button><Button aria-label="ดูภาพถัดไป" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90" onClick={() => select(selectedIndex + 1)} size="icon" variant="outline"><ChevronRightIcon aria-hidden /></Button></>}<Badge className="absolute bottom-3 right-3 bg-foreground/75 text-background" variant="secondary">{selectedIndex + 1} / {images.length}</Badge></div>{images.length > 1 && <div aria-label="เลือกภาพบ้าน" className="flex gap-2 overflow-x-auto pb-1" role="group">{images.slice(0, 4).map((thumb, index) => <button aria-label={`เปิดรูปที่ ${index + 1} จาก ${images.length}`} aria-pressed={index === selectedIndex} className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg outline-offset-2 ring-1 ring-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-primary" key={thumb.id} onClick={() => select(index)} type="button"><img alt="" className="size-full object-cover" src={thumb.url} /></button>)}{totalImageCount > 4 && (imagesHref ? <Link aria-label={`ไปจัดการรูปภาพบ้าน มีรูปที่เหลืออีก ${totalImageCount - 4} รูป`} className="grid aspect-[4/3] w-20 shrink-0 place-items-center rounded-lg bg-foreground/70 text-sm font-semibold text-background outline-offset-2 hover:bg-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" href={imagesHref}>+{totalImageCount - 4}</Link> : <span aria-label={`ยังมีรูปอีก ${totalImageCount - 4} รูป`} className="grid aspect-[4/3] w-20 shrink-0 place-items-center rounded-lg bg-foreground/70 text-sm font-semibold text-background">+{totalImageCount - 4}</span>)}</div>}</section>;
}

type SectionIcon = typeof BedDoubleIcon;

function CardHeading({ action, icon: Icon, title }: { action?: React.ReactNode; icon: SectionIcon; title: string }) {
  return <CardHeader className="items-center border-b py-3"><CardTitle className="inline-flex min-w-0 items-center gap-2"><Icon aria-hidden className="size-4 shrink-0" />{title}</CardTitle>{action && <CardAction>{action}</CardAction>}</CardHeader>;
}

function EmptyCard({ icon: Icon, message, title }: { icon: SectionIcon; message: string; title: string }) {
  return <Card className="h-full gap-0 py-0" size="sm"><CardHeading icon={Icon} title={title} /><CardContent className="flex flex-1 flex-col"><div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 py-6 text-center"><span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><Icon aria-hidden className="size-5" /></span><p className="text-sm text-muted-foreground">{message}</p></div></CardContent></Card>;
}

function MobileSection({ children, id, onOpenChange, open, icon: Icon, summary, title }: { children: React.ReactNode; id: string; onOpenChange: (id: string, open: boolean) => void; open: boolean; icon: SectionIcon; summary: string; title: string }) {
  return <details className="group rounded-xl border bg-card shadow-sm" data-dashboard-house-mobile-section open={open} onToggle={event => onOpenChange(id, event.currentTarget.open)}>
    <summary className="flex min-h-[5.25rem] cursor-pointer list-none items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
      <Icon aria-hidden className="size-7 shrink-0 text-primary" />
      <span className="min-w-0 flex-1"><span className="block font-heading text-base font-semibold">{title}</span><span className="mt-0.5 block truncate text-sm text-muted-foreground">{summary}</span></span>
      <ChevronDownIcon aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t px-4 py-4">{children}</div>
  </details>;
}

export function DashboardHouseDetailView({ backHref, backLabel, detail, houseDetailReturnTo, query }: DashboardHouseDetailViewProps) {
  const { data, house } = detail;
  const returnTo = houseDetailReturnTo ?? dashboardHouseDetailHref({ month: query.month, search: query.houseSearch, page: query.housesPage }, house.id);
  const propertyId = data.propertyId;
  const imagesHref = propertyId ? `/admin/houses/${encodeURIComponent(propertyId)}/images?returnTo=${encodeURIComponent(returnTo)}` : null;
  const active = data.isActive ?? house.isActive;
  const hasPrices = data.prices.some(price => price.devillePrice !== null || price.agencyPrice !== null);
  const ratingOption = HOUSE_RATING_OPTIONS.find(option => option.value === data.rating);
  const rating = data.rating == null || data.rating <= 0 || !ratingOption ? null : `${ratingOption.value} - ${ratingOption.label}`;
  const [priceSource, setPriceSource] = useState<"deville" | "agency">("deville");
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const handleMobileSectionToggle = (id: string, open: boolean) => {
    if (open) setOpenMobileSection(id);
    else setOpenMobileSection(current => current === id ? null : current);
  };
  const priceTab = (value: typeof priceSource, label: string) => <button aria-pressed={priceSource === value} className="min-h-9 flex-1 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground aria-pressed:border-primary aria-pressed:text-primary" onClick={() => setPriceSource(value)} type="button">{label}</button>;
  return <div className="mx-auto min-w-0 max-w-7xl space-y-4">
    <Button asChild className="w-fit" size="sm" variant="ghost"><Link href={backHref}><ArrowLeftIcon data-icon="inline-start" />{backLabel}</Link></Button>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_16rem] xl:items-start">
      <HouseGallery detail={detail} imagesHref={imagesHref} />
      <div className="hidden min-w-0 space-y-3 xl:block"><Badge className="gap-2 bg-emerald-100 text-emerald-800" variant="secondary"><span aria-hidden className={`size-2 rounded-full ${active ? "bg-emerald-600" : "bg-muted-foreground"}`} />{active === null ? "ไม่ระบุสถานะ" : active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge><div><h1 className="break-words text-2xl font-semibold tracking-tight">{data.title}</h1><p className="mt-1 text-sm text-muted-foreground">DV-{data.propertyId ?? "ไม่ระบุ"}</p></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPinIcon aria-hidden className="size-4" />{formatZone(data.locationZone) === "-" ? "ไม่ระบุโซน" : formatZone(data.locationZone)}</span><span className="inline-flex items-center gap-1"><HouseIcon aria-hidden className="size-4" />{houseType(data.propertyType)}</span></div>{data.description && <p className="text-sm leading-6 text-muted-foreground">{data.description}</p>}{data.propertyTags.length > 0 && <div className="flex flex-wrap gap-2">{data.propertyTags.map(tag => <Badge className="rounded-full bg-primary/10 text-primary" key={tag} variant="secondary">{tag}</Badge>)}</div>}<Card className="bg-primary/5" size="sm"><CardHeader><CardTitle className="inline-flex items-center gap-2"><FileTextIcon aria-hidden className="size-4" />โน้ตภายใน</CardTitle></CardHeader><CardContent>{data.notes ? <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{data.notes}</p> : <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-5 text-center"><span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><FileTextIcon aria-hidden className="size-5" /></span><p className="text-sm text-muted-foreground">ยังไม่มีโน้ตภายใน</p></div>}</CardContent></Card></div>
      <Card className="hidden bg-muted/30 xl:block" size="sm"><CardContent className="flex flex-col gap-3 p-4">{propertyId && <Button asChild className="w-full" size="sm" variant="outline"><Link href={managementHref(propertyId, returnTo)}><HouseIcon aria-hidden />จัดการบ้าน</Link></Button>}<Button asChild className="w-full" size="sm"><Link href={`/admin/bookings?search=${encodeURIComponent(propertyId ?? "")}&searchMode=dv`}><CalendarDaysIcon aria-hidden />ดูตารางบ้านพัก</Link></Button></CardContent></Card>
    </section>
    <Card className="hidden xl:block" size="sm"><CardContent className="grid gap-x-3 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5 xl:grid-cols-5"><Fact icon={BedDoubleIcon} label="ห้องนอน" value={data.bedrooms === null ? "—" : `${data.bedrooms} ห้อง`} /><Fact icon={BathIcon} label="ห้องน้ำ" value={data.bathrooms === null ? "—" : `${data.bathrooms} ห้อง`} /><Fact icon={UsersRoundIcon} label="รองรับสูงสุด" value={data.maxGuests === null ? "—" : `${data.maxGuests} คน`} /><Fact icon={LogInIcon} label="เช็กอิน" value={`${time(data.checkinTime)} น.`} /><Fact icon={LogOutIcon} label="เช็กเอาต์" value={`${time(data.checkoutTime)} น.`} /></CardContent></Card>
    <section className="hidden gap-4 xl:grid xl:grid-cols-3">
      {!hasPrices ? <EmptyCard icon={BadgeDollarSignIcon} message="ยังไม่ได้กำหนดราคา" title="ราคา" /> : <Card className="h-full gap-0 py-0" size="sm"><CardHeading action={propertyId ? <Button asChild className="text-primary" size="sm" variant="ghost"><Link href={managementHref(propertyId, returnTo, "prices")}>ดูรายละเอียดราคา <ChevronRightIcon aria-hidden /></Link></Button> : undefined} icon={BadgeDollarSignIcon} title="ราคา" /><CardContent className="flex-1"><div className="flex border-b">{priceTab("deville", "Deville")}{priceTab("agency", "เอเจนซี")}</div><Table><TableBody>{data.prices.map(price => <TableRow key={price.dayOfWeek ?? "unknown"}><TableCell><span className="block">{price.dayOfWeek === null ? "ไม่ระบุ" : weekday[price.dayOfWeek] ?? "ไม่ระบุ"}</span>{price.note && <span className="text-xs text-muted-foreground">{price.note}</span>}</TableCell><TableCell className="text-right font-medium">{(priceSource === "deville" ? price.devillePrice : price.agencyPrice) === null ? "—" : dashboardMoney(((priceSource === "deville" ? price.devillePrice : price.agencyPrice) ?? 0) * 100)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
      {data.facilities.length === 0 ? <EmptyCard icon={SparklesIcon} message="ยังไม่มีสิ่งอำนวยความสะดวก" title="สิ่งอำนวยความสะดวก" /> : <Card className="h-full gap-0 py-0" size="sm"><CardHeading action={propertyId ? <Button asChild className="text-primary" size="sm" variant="ghost"><Link href={managementHref(propertyId, returnTo, "facilities")}>ดูทั้งหมด <ChevronRightIcon aria-hidden /></Link></Button> : undefined} icon={SparklesIcon} title="สิ่งอำนวยความสะดวก" /><CardContent className="flex-1"><ul className="divide-y">{data.facilities.slice(0, 5).map(facility => <li className="flex items-center gap-3 py-2.5 text-sm" key={facility.id}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><FacilityIcon facility={facility} /></span><span className="min-w-0 truncate font-medium">{facility.title ?? facility.name ?? "ไม่ระบุ"}</span></li>)}</ul></CardContent></Card>}
      <Card className="h-full gap-0 py-0" size="sm"><CardHeading icon={BriefcaseBusinessIcon} title="ข้อมูลการจัดการ" /><CardContent className="flex-1"><dl className="divide-y text-sm"><div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">เจ้าของบ้าน</dt><dd>{data.ownerName ?? "ยังไม่ระบุ"}</dd></div><div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">เรตติ้ง</dt><dd className="max-w-[65%] text-right">{rating ?? "ยังไม่กำหนด"}</dd></div>{data.insuranceFee !== null && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">ค่าประกัน</dt><dd className="tabular-nums">{dashboardMoney(data.insuranceFee * 100)}</dd></div>}{data.extraBedPrice !== null && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">ราคาเตียงเสริม</dt><dd className="tabular-nums">{dashboardMoney(data.extraBedPrice * 100)}</dd></div>}{data.createdAt && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">วันที่สร้าง</dt><dd>{dashboardDate(data.createdAt, true)}</dd></div>}{data.updatedAt && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">อัปเดตล่าสุด</dt><dd>{dashboardDate(data.updatedAt, true)}</dd></div>}</dl>{data.propertyTags.length > 0 && <div className="mt-3 flex flex-wrap items-start gap-2 border-t pt-3"><span className="mr-1 text-xs text-muted-foreground">แท็ก</span>{data.propertyTags.map(tag => <Badge className="rounded-full bg-primary/10 text-primary" key={tag} variant="secondary">{tag}</Badge>)}</div>}</CardContent></Card>
    </section>
    <section aria-label="รายละเอียดบ้านบนมือถือ" className="space-y-3 xl:hidden" data-dashboard-house-mobile-sections>
      <Card size="sm"><CardContent className="space-y-4 p-4">
        <div className="space-y-2"><Badge className={`gap-2 ${active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`} variant="secondary"><span aria-hidden className={`size-2 rounded-full ${active ? "bg-emerald-600" : "bg-muted-foreground"}`} />{active === null ? "ไม่ระบุสถานะ" : active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge><h1 className="break-words text-2xl font-semibold tracking-tight">{data.title}</h1><p className="text-muted-foreground">DV-{data.propertyId ?? "ไม่ระบุ"}</p><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><HouseIcon aria-hidden className="size-5" />{houseType(data.propertyType)}</span><span className="inline-flex items-center gap-2"><MapPinIcon aria-hidden className="size-5" />{formatZone(data.locationZone) === "-" ? "ไม่ระบุโซน" : formatZone(data.locationZone)}</span></div></div>
        <div className="grid grid-cols-5 divide-x rounded-xl border py-3 text-center">
          <div className="px-1"><BedDoubleIcon aria-hidden className="mx-auto size-5 text-primary" /><p className="mt-1 text-sm font-semibold">{data.bedrooms ?? "—"}</p><p className="text-xs text-muted-foreground">ห้องนอน</p></div>
          <div className="px-1"><BathIcon aria-hidden className="mx-auto size-5 text-primary" /><p className="mt-1 text-sm font-semibold">{data.bathrooms ?? "—"}</p><p className="text-xs text-muted-foreground">ห้องน้ำ</p></div>
          <div className="px-1"><UsersRoundIcon aria-hidden className="mx-auto size-5 text-primary" /><p className="mt-1 text-sm font-semibold">{data.maxGuests ?? "—"}</p><p className="text-xs text-muted-foreground">คน</p></div>
          <div className="px-1"><LogInIcon aria-hidden className="mx-auto size-5 text-primary" /><p className="mt-1 text-xs text-muted-foreground">เช็กอิน</p><p className="text-xs font-semibold">{time(data.checkinTime)} น.</p></div>
          <div className="px-1"><LogOutIcon aria-hidden className="mx-auto size-5 text-primary" /><p className="mt-1 text-xs text-muted-foreground">เช็กเอาต์</p><p className="text-xs font-semibold">{time(data.checkoutTime)} น.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3"><Button asChild className="w-full" variant="outline"><Link href={`/admin/bookings?search=${encodeURIComponent(propertyId ?? "")}&searchMode=dv`}><CalendarDaysIcon aria-hidden />ดูปฏิทินบ้าน</Link></Button>{propertyId ? <Button asChild className="w-full" variant="outline"><Link href={managementHref(propertyId, returnTo)}><HouseIcon aria-hidden />จัดการบ้าน</Link></Button> : <Button className="w-full" disabled variant="outline"><HouseIcon aria-hidden />จัดการบ้าน</Button>}</div>
      </CardContent></Card>
      <MobileSection id="basic" onOpenChange={handleMobileSectionToggle} open={openMobileSection === "basic"} icon={FileTextIcon} title="ข้อมูลพื้นฐาน" summary={`${houseType(data.propertyType)} · ${formatZone(data.locationZone) === "-" ? "ไม่ระบุโซน" : formatZone(data.locationZone)}`}>
        <div className="space-y-3 text-sm">{data.description && <p className="leading-6 text-muted-foreground">{data.description}</p>}<dl className="divide-y"><div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">สถานะ</dt><dd>{active === null ? "ไม่ระบุสถานะ" : active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</dd></div>{data.createdAt && <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">วันที่สร้าง</dt><dd>{dashboardDate(data.createdAt, true)}</dd></div>}</dl>{data.propertyTags.length > 0 && <div className="flex flex-wrap gap-2">{data.propertyTags.map(tag => <Badge className="rounded-full bg-primary/10 text-primary" key={tag} variant="secondary">{tag}</Badge>)}</div>}<div><h3 className="mb-2 inline-flex items-center gap-2 font-medium"><FileTextIcon aria-hidden className="size-4" />โน้ตภายใน</h3><p className="min-h-12 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-muted-foreground">{data.notes || "ยังไม่มีโน้ตภายใน"}</p></div></div>
      </MobileSection>
      <MobileSection id="prices" onOpenChange={handleMobileSectionToggle} open={openMobileSection === "prices"} icon={BadgeDollarSignIcon} title="ราคา" summary={hasPrices ? `ราคา Deville และเอเจนซี · ${data.prices.length} วัน` : "ยังไม่ได้กำหนดราคา"}>
        {hasPrices ? <><div className="flex border-b">{priceTab("deville", "Deville")}{priceTab("agency", "เอเจนซี")}</div><Table><TableBody>{data.prices.map(price => <TableRow key={price.dayOfWeek ?? "unknown"}><TableCell><span className="block">{price.dayOfWeek === null ? "ไม่ระบุ" : weekday[price.dayOfWeek] ?? "ไม่ระบุ"}</span>{price.note && <span className="text-xs text-muted-foreground">{price.note}</span>}</TableCell><TableCell className="text-right font-medium">{(priceSource === "deville" ? price.devillePrice : price.agencyPrice) === null ? "—" : dashboardMoney(((priceSource === "deville" ? price.devillePrice : price.agencyPrice) ?? 0) * 100)}</TableCell></TableRow>)}</TableBody></Table></> : <EmptyState icon={BadgeDollarSignIcon} message="ยังไม่ได้กำหนดราคา" />}
      </MobileSection>
      <MobileSection id="facilities" onOpenChange={handleMobileSectionToggle} open={openMobileSection === "facilities"} icon={SparklesIcon} title="สิ่งอำนวยความสะดวก" summary={data.facilities.length ? `${data.facilities.length} รายการ` : "ยังไม่มีสิ่งอำนวยความสะดวกที่เปิดใช้งาน"}>
        {data.facilities.length ? <ul className="divide-y">{data.facilities.map(facility => <li className="flex items-center gap-3 py-3 text-sm" key={facility.id}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><FacilityIcon facility={facility} /></span><span className="min-w-0 flex-1 font-medium">{facility.title ?? facility.name ?? "ไม่ระบุ"}</span></li>)}</ul> : <EmptyState icon={SparklesIcon} message="ยังไม่มีสิ่งอำนวยความสะดวกที่เปิดใช้งาน" />}
      </MobileSection>
      <MobileSection id="management" onOpenChange={handleMobileSectionToggle} open={openMobileSection === "management"} icon={BriefcaseBusinessIcon} title="การจัดการ" summary="เจ้าของบ้าน เรตติ้ง และข้อมูลการดูแล">
        <dl className="divide-y text-sm"><div className="flex justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><CircleUserRoundIcon aria-hidden className="size-4" />เจ้าของบ้าน</dt><dd>{data.ownerName ?? "ยังไม่ระบุเจ้าของบ้าน"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><StarIcon aria-hidden className="size-4" />เรตติ้ง</dt><dd className="max-w-[65%] text-right">{rating ?? "ยังไม่กำหนด"}</dd></div>{data.insuranceFee !== null && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">ค่าประกัน</dt><dd>{dashboardMoney(data.insuranceFee * 100)}</dd></div>}{data.extraBedPrice !== null && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">ราคาเตียงเสริม</dt><dd>{dashboardMoney(data.extraBedPrice * 100)}</dd></div>}{data.updatedAt && <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">อัปเดตล่าสุด</dt><dd>{dashboardDate(data.updatedAt, true)}</dd></div>}</dl>{propertyId && <Button asChild className="mt-4 w-full" variant="outline"><Link href={managementHref(propertyId, returnTo)}><HouseIcon aria-hidden />จัดการบ้าน</Link></Button>}
      </MobileSection>
    </section>
  </div>;
}

function EmptyState({ icon: Icon, message }: { icon: SectionIcon; message: string }) {
  return <div className="flex min-h-32 flex-col items-center justify-center gap-2 py-6 text-center"><span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><Icon aria-hidden className="size-5" /></span><p className="text-sm text-muted-foreground">{message}</p></div>;
}
