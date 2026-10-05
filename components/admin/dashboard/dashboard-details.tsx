"use client";

/* eslint-disable @next/next/no-img-element -- cover images are stored in tenant-controlled Supabase Storage URLs. */
import Link from "next/link";
import { BarChart3Icon, Building2Icon, CalendarDaysIcon, CircleDollarSignIcon, CircleUserRoundIcon, CreditCardIcon, HouseIcon, MapPinIcon, MoonIcon, PhoneIcon, PieChartIcon, SparklesIcon, StickyNoteIcon, TagIcon, TicketCheckIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { dashboardBackHref } from "../../../lib/dashboard-navigation";
import { dashboardAgencyBookingDetailHref, dashboardAgencyDetailBookingQuery, dashboardAgencyDetailHref, dashboardBookingDetailHref, type DashboardAgencyDetailQuery } from "../../../lib/dashboard-routes";
import { dashboardDate, dashboardMoney, dashboardStatus, type DashboardCustomer, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardNights } from "../../../lib/dashboard-calculations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { DashboardBookingStatusBadge } from "./dashboard-rows";
import { DashboardTaskHeader } from "./dashboard-task-header";
import { DashboardDetailLayout } from "./dashboard-detail-layout";
import { DashboardSummaryCard } from "./dashboard-summary-card";
import { DashboardTabs } from "./dashboard-tabs";
import { BookingsList } from "./bookings-list";
import { DashboardHouseDetailView } from "./dashboard-house-detail";

interface DashboardDetailsProps {
  backHref?: string;
  backLabel?: string;
  agencyQuery?: DashboardAgencyDetailQuery;
  houseReturnTo?: string;
  houseDetailReturnTo?: string;
  query: DashboardQuery;
  report: DashboardReport;
  loadBookingCustomer?: (bookingId: string) => Promise<{ ok: true; customer: DashboardCustomer | null } | { ok: false; customer: null }>;
}

function AgencySummaryMetric({ accent, children, className, compactMobile = false, description, icon: Icon, label, visual }: { accent: "blue" | "green" | "orange"; children: ReactNode; className?: string; compactMobile?: boolean; description: string; icon: LucideIcon; label: string; visual: ReactNode }) {
  const colors = accent === "blue" ? "bg-blue-50 text-blue-600" : accent === "green" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500";
  const mobileSpacing = compactMobile ? "p-4 md:p-5" : "p-5";
  const iconSize = compactMobile ? "size-11 md:size-14" : "size-14";
  const valueSize = compactMobile ? "text-xl md:text-2xl" : "text-2xl";
  return <article className={`relative min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm ${mobileSpacing} ${className ?? ""}`}><div className="relative z-10 flex min-w-0 items-center gap-3 md:gap-4"><span className={`grid shrink-0 place-items-center rounded-full ${iconSize} ${colors}`}><Icon aria-hidden className="size-5 md:size-6" /></span><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className={`mt-0.5 truncate font-bold tracking-tight text-foreground ${valueSize}`}>{children}</p><p className={`mt-1 text-xs text-muted-foreground ${compactMobile ? "hidden md:block" : ""}`}>{description}</p></div></div><div aria-hidden className="absolute right-5 top-1/2 hidden -translate-y-1/2 opacity-25 md:block">{visual}</div></article>;
}

function BookingDetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[1.25rem_minmax(6.5rem,9rem)_minmax(0,1fr)] items-center gap-x-3 border-b py-3 text-sm last:border-b-0">
    <Icon aria-hidden className="size-4 text-primary" />
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{children}</dd>
  </div>;
}

function BookingTimestampsRow({ createdAt, updatedAt }: { createdAt: string; updatedAt: string }) {
  return <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-b py-3 text-sm">
    <CalendarDaysIcon aria-hidden className="mt-0.5 size-4 text-primary" />
    <div className="flex min-w-0 flex-wrap items-center justify-start gap-x-6 gap-y-1">
      <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-muted-foreground">วันที่สร้าง</dt><dd className="break-words font-medium">{dashboardDate(createdAt, true)}</dd></div>
      <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-muted-foreground">อัปเดตล่าสุด</dt><dd className="break-words font-medium">{dashboardDate(updatedAt, true)}</dd></div>
    </div>
  </div>;
}

type BookingDashboardDetail = Extract<NonNullable<DashboardReport["detail"]>, { kind: "booking" }>;

function BookingSummaryContent({
  booking,
  checkInTime,
  checkOutTime,
  amount,
  coverImageUrl,
  houseHref,
}: {
  booking: BookingDashboardDetail["booking"];
  checkInTime: string | null;
  checkOutTime: string | null;
  amount: string;
  coverImageUrl: string | null;
  houseHref: string;
}) {
  const time = (value: string | null) => value?.slice(0, 5) ?? "—";
  const dateWithTime = (date: string, value: string | null) => value ? `${dashboardDate(date)} · ${time(value)}` : dashboardDate(date);
  return <>
    {coverImageUrl ? <img alt={`รูปบ้าน ${booking.houseTitle}`} className="aspect-video w-full rounded-lg object-cover" data-dashboard-booking-cover loading="lazy" src={coverImageUrl} /> : <div aria-hidden className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground"><Building2Icon className="size-10" /></div>}
    <div className="-mt-1"><p className="break-words font-semibold">{booking.houseTitle}</p><p className="text-xs text-muted-foreground">DV-{booking.propertyId}</p></div>
    <dl className="divide-y text-sm"><div className="flex items-center justify-between gap-4 py-2"><dt className="flex items-center gap-2 text-muted-foreground"><CalendarDaysIcon aria-hidden className="size-4" />เข้าพัก</dt><dd>{dateWithTime(booking.checkIn, checkInTime)}</dd></div><div className="flex items-center justify-between gap-4 py-2"><dt className="flex items-center gap-2 text-muted-foreground"><CalendarDaysIcon aria-hidden className="size-4" />เช็กเอาต์</dt><dd>{dateWithTime(booking.checkOut, checkOutTime)}</dd></div><div className="flex items-center justify-between gap-4 py-2"><dt className="flex items-center gap-2 text-muted-foreground"><MoonIcon aria-hidden className="size-4" />จำนวนคืน</dt><dd>{dashboardNights(booking.checkIn, booking.checkOut) ?? "—"}</dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 font-medium"><CircleDollarSignIcon aria-hidden className="size-4" />ยอดจอง</dt><dd className="font-semibold tabular-nums text-primary">{amount}</dd></div></dl>
    <Button asChild className="w-full" variant="secondary"><Link href={houseHref}><HouseIcon aria-hidden className="size-4" />ดูข้อมูลบ้าน</Link></Button>
  </>;
}

function CustomerFact({ children, label }: { children: ReactNode; label: string }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium [overflow-wrap:anywhere]">{children}</dd></div>;
}

function BookingCustomerDetailContent({ customer, mobile = false }: { customer: BookingDashboardDetail["customer"]; mobile?: boolean }) {
  if (!customer) return <p className="py-3 text-sm text-muted-foreground">ยังไม่มีข้อมูลลูกค้าที่ผูกกับการจองนี้</p>;
  const language = customer.preferredLanguage === "th" ? "ไทย" : customer.preferredLanguage === "en" ? "English" : customer.preferredLanguage ?? "—";
  const fullName = [customer.title, customer.firstName, customer.lastName].filter((value): value is string => Boolean(value)).join(" ") || "—";
  const address = [customer.address, customer.subDistrict, customer.district, customer.province, customer.postalCode, customer.country].filter((value): value is string => Boolean(value)).join(" ") || "—";
  const sectionClass = mobile ? "border-b pb-5 last:border-b-0 last:pb-0" : "overflow-hidden rounded-xl border";
  const headingClass = mobile ? "flex items-center gap-2 border-b pb-3 font-heading text-sm leading-snug font-medium" : "flex items-center gap-2 border-b px-4 py-3 font-heading text-sm leading-snug font-medium";
  const factGridClass = mobile ? "grid grid-cols-2 gap-x-4 gap-y-4 pt-4 text-sm" : "grid grid-cols-2 text-sm [&>div]:min-w-0 [&>div]:p-4 [&>div:nth-child(odd)]:border-r [&>div:nth-child(-n+2)]:border-b";
  const bodyClass = mobile ? "pt-4" : "p-4";
  return <div className={mobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
    <section className={sectionClass}><h3 className={headingClass}><CircleUserRoundIcon aria-hidden className="size-5 text-primary" />ข้อมูลส่วนตัว</h3><dl className={factGridClass}><CustomerFact label="ชื่อ - นามสกุล">{fullName}</CustomerFact><CustomerFact label="สัญชาติ">{customer.nationality ?? "—"}</CustomerFact><CustomerFact label="ภาษาที่ใช้">{language}</CustomerFact><CustomerFact label="สถานะ VIP">{customer.vipStatus ? <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">VIP</span> : "ทั่วไป"}</CustomerFact></dl></section>
    <section className={sectionClass}><h3 className={headingClass}><PhoneIcon aria-hidden className="size-5 text-primary" />ช่องทางติดต่อ</h3><dl className={factGridClass}><CustomerFact label="เบอร์โทรหลัก">{customer.phone || "—"}</CustomerFact><CustomerFact label="เบอร์สำรอง">{customer.secondaryPhone ?? "—"}</CustomerFact><CustomerFact label="อีเมล"><span className="block min-w-0 break-all">{customer.email ?? "—"}</span></CustomerFact><CustomerFact label="LINE ID"><span className="block min-w-0 break-all">{customer.lineId ?? "—"}</span></CustomerFact></dl></section>
    <section className={sectionClass}><h3 className={headingClass}><MapPinIcon aria-hidden className="size-5 text-primary" />ที่อยู่</h3><div className={bodyClass}><p className="rounded-lg bg-muted/50 p-3 whitespace-pre-line text-sm leading-6">{address}</p></div></section>
    <section className={sectionClass}><h3 className={headingClass}><SparklesIcon aria-hidden className="size-5 text-primary" />ความต้องการพิเศษ</h3><div className={bodyClass}><p className="rounded-lg bg-muted/50 p-3 whitespace-pre-line text-sm leading-6">{customer.specialRequests ?? "—"}</p></div></section>
    {mobile ? <section className={sectionClass}><h3 className={headingClass}><StickyNoteIcon aria-hidden className="size-5 text-primary" />หมายเหตุลูกค้า</h3><div className={bodyClass}><p className="rounded-lg bg-muted/50 p-3 whitespace-pre-line text-sm leading-6">{customer.notes ?? "—"}</p></div></section> : <Card className="md:col-span-2 bg-primary/5" size="sm"><CardHeader><CardTitle className="font-semibold">หมายเหตุลูกค้า</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm">{customer.notes ?? "—"}</p></CardContent></Card>}
  </div>;
}

function BookingCostsContent({ costs, mobile = false, status }: { costs: BookingDashboardDetail["costs"]; mobile?: boolean; status: string }) {
  const value = (cents: number | null) => status === "repair" ? "—" : cents === null ? "ไม่ระบุยอด" : dashboardMoney(cents);
  const row = (label: string, content: ReactNode) => <div className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right font-medium [overflow-wrap:anywhere]">{content}</dd></div>;
  const rows = <dl>{row("ค่าบ้านเต็มจำนวน", value(costs.fullPriceCents))}{row("มัดจำที่ต้องชำระ", value(costs.depositCents))}{row("ค่าใช้จ่ายเพิ่ม", value(costs.extraChargeCents))}{row("ประกันที่พัก", value(costs.insuranceCents))}{status === "waiting" && row("หมดอายุการชำระ", costs.paymentExpiresAt ? dashboardDate(costs.paymentExpiresAt, true) : "—")}</dl>;
  return mobile ? rows : <Card size="sm"><CardHeader className="border-b"><CardTitle className="font-semibold">สรุปค่าใช้จ่าย</CardTitle></CardHeader><CardContent>{rows}</CardContent></Card>;
}

function BookingCustomerLoading() {
  return <div aria-busy className="space-y-4" data-dashboard-booking-customer-loading><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="grid grid-cols-2 gap-4"><div className="h-14 animate-pulse rounded bg-muted" /><div className="h-14 animate-pulse rounded bg-muted" /></div><div className="h-5 w-36 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded bg-muted" /></div>;
}

export function DashboardDetails({
  backHref,
  backLabel = "กลับไปหน้าก่อนหน้า",
  agencyQuery,
  houseReturnTo,
  houseDetailReturnTo,
  query,
  report,
  loadBookingCustomer,
}: DashboardDetailsProps) {
  const [bookingTab, setBookingTab] = useState<"booking" | "customer" | "costs">("booking");
  const [customer, setCustomer] = useState<BookingDashboardDetail["customer"] | undefined>(undefined);
  const [customerError, setCustomerError] = useState(false);
  const [isCustomerPending, startCustomerTransition] = useTransition();
  const detail = report.detail;
  if (!detail) return null;

  const resolvedBackHref = backHref ?? dashboardBackHref(query);

  if (detail.kind === "booking") {
    const booking = detail.booking;
    const status = dashboardStatus(booking.status);
    const amount = status === "repair" ? "—" : booking.priceCents === null ? "ไม่ระบุยอด" : dashboardMoney(booking.priceCents);
    const agency = detail.agency?.name ?? "ไม่ระบุเอเจนซี่";
    const channel = detail.agency?.id ? "เอเจนซี่" : "ไม่ระบุ";
    const bookingReturnTo = houseReturnTo ?? dashboardBookingDetailHref({ month: query.month, status: query.status, search: query.search, sort: "updated-desc", page: query.page }, booking.id);
    const houseHref = `/admin/houses/${encodeURIComponent(booking.propertyId)}?returnTo=${encodeURIComponent(bookingReturnTo)}`;
    const selectBookingTab = (next: typeof bookingTab | undefined) => {
      if (!next) return;
      setBookingTab(next);
      if (next !== "customer" || customer !== undefined || isCustomerPending) return;
      setCustomerError(false);
      startCustomerTransition(async () => {
        if (!loadBookingCustomer) {
          setCustomerError(true);
          return;
        }
        const result = await loadBookingCustomer(booking.id);
        if (result.ok) setCustomer(result.customer);
        else setCustomerError(true);
      });
    };
    const customerContent = customer === undefined
      ? <BookingCustomerLoading />
      : customerError
        ? <p role="status" className="py-3 text-sm text-destructive">ไม่สามารถโหลดข้อมูลลูกค้าได้</p>
        : <BookingCustomerDetailContent customer={customer} mobile={false} />;
    const tabs = [{ label: "ข้อมูลการจอง", icon: TicketCheckIcon, value: "booking" as const }, { label: "ข้อมูลลูกค้า", icon: CircleUserRoundIcon, value: "customer" as const }, { label: "ค่าใช้จ่าย", icon: CreditCardIcon, value: "costs" as const }];
    return <DashboardDetailLayout>
      <header className="space-y-1 lg:hidden"><div className="flex items-center justify-between gap-3"><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium" href={resolvedBackHref}><span aria-hidden>←</span>{backLabel}</Link><DashboardBookingStatusBadge status={status} /></div><h1 className="text-xl font-semibold">รายละเอียดการจอง</h1><p className="text-sm font-medium text-muted-foreground">{booking.houseTitle}</p><p className="text-xs text-muted-foreground">DV-{booking.propertyId}</p></header>
      <div className="hidden lg:block"><DashboardTaskHeader backHref={resolvedBackHref} backLabel={backLabel} description={`${booking.houseTitle} · DV-${booking.propertyId}`} title="รายละเอียดการจอง" /></div>
      <DashboardTabs ariaLabel="ส่วนของรายละเอียดการจอง" className="hidden lg:flex" onValueChange={selectBookingTab} tabs={tabs} value={bookingTab} />
      <div className="space-y-4 lg:hidden" data-dashboard-booking-mobile-summary><BookingSummaryContent amount={amount} booking={booking} checkInTime={detail.checkInTime} checkOutTime={detail.checkOutTime} coverImageUrl={detail.coverImageUrl} houseHref={houseHref} /><div><nav aria-label="ส่วนของรายละเอียดการจองบนมือถือ" className="flex gap-1 overflow-x-auto border-b pb-px" data-dashboard-booking-mobile-tabs role="tablist">{[{ label: "ข้อมูลการจอง", icon: TicketCheckIcon, value: "booking" as const }, { label: "ข้อมูลลูกค้า", icon: CircleUserRoundIcon, value: "customer" as const }, { label: "ค่าใช้จ่าย", icon: CreditCardIcon, value: "costs" as const }].map(({ label, icon: Icon, value }) => <button aria-selected={value === bookingTab} className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground aria-selected:border-primary aria-selected:text-primary" key={label} onClick={() => selectBookingTab(value)} role="tab" type="button"><Icon aria-hidden className="size-4" />{label}</button>)}</nav><div className="pt-4"><div className={bookingTab === "booking" ? "" : "hidden"}><dl data-dashboard-booking-mobile-timestamps><BookingDetailRow icon={TicketCheckIcon} label="รหัสจอง">{booking.code}</BookingDetailRow><BookingDetailRow icon={CalendarDaysIcon} label="วันที่สร้าง">{dashboardDate(booking.createdAt, true)}</BookingDetailRow><BookingDetailRow icon={CalendarDaysIcon} label="อัปเดตล่าสุด">{dashboardDate(booking.updatedAt, true)}</BookingDetailRow><BookingDetailRow icon={CircleUserRoundIcon} label="ผู้บันทึก">{detail.createdByName ?? "ไม่ระบุผู้บันทึก"}</BookingDetailRow><BookingDetailRow icon={Building2Icon} label="เอเจนซี่">{agency}</BookingDetailRow><BookingDetailRow icon={HouseIcon} label="บ้าน / โครงการ">{booking.houseTitle}</BookingDetailRow><BookingDetailRow icon={TagIcon} label="สถานะ"><DashboardBookingStatusBadge status={status} /></BookingDetailRow><BookingDetailRow icon={TicketCheckIcon} label="ช่องทางการจอง">{channel}</BookingDetailRow></dl></div><div className={bookingTab === "customer" ? "" : "hidden"}>{customer === undefined ? <BookingCustomerLoading /> : customerError ? <p role="status" className="py-3 text-sm text-destructive">ไม่สามารถโหลดข้อมูลลูกค้าได้</p> : <BookingCustomerDetailContent customer={customer} mobile />}</div><div className={bookingTab === "costs" ? "" : "hidden"}><BookingCostsContent costs={detail.costs} mobile status={status} /></div></div></div></div>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DashboardSummaryCard status={<DashboardBookingStatusBadge status={status} />} title="สรุปการจอง"><BookingSummaryContent amount={amount} booking={booking} checkInTime={detail.checkInTime} checkOutTime={detail.checkOutTime} coverImageUrl={detail.coverImageUrl} houseHref={houseHref} /></DashboardSummaryCard>
        <div className="order-first">
          <div className={bookingTab === "booking" ? "space-y-4" : "hidden"}><Card size="sm"><CardHeader className="border-b"><CardTitle className="font-semibold">ข้อมูลการจอง</CardTitle></CardHeader><CardContent><dl>
            <BookingDetailRow icon={TicketCheckIcon} label="รหัสจอง">{booking.code}</BookingDetailRow>
            <BookingTimestampsRow createdAt={booking.createdAt} updatedAt={booking.updatedAt} />
            <BookingDetailRow icon={CircleUserRoundIcon} label="ผู้บันทึก">{detail.createdByName ?? "ไม่ระบุผู้บันทึก"}</BookingDetailRow>
            <BookingDetailRow icon={Building2Icon} label="เอเจนซี่">{agency}</BookingDetailRow>
            <BookingDetailRow icon={HouseIcon} label="บ้าน / โครงการ">{booking.houseTitle}</BookingDetailRow>
            <BookingDetailRow icon={TagIcon} label="สถานะ"><DashboardBookingStatusBadge status={status} /></BookingDetailRow>
            <BookingDetailRow icon={TicketCheckIcon} label="ช่องทางการจอง">{channel}</BookingDetailRow>
          </dl></CardContent></Card>
          {detail.note && <Card className="bg-primary/5" size="sm"><CardHeader><CardTitle className="font-semibold">หมายเหตุ</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm">{detail.note}</p></CardContent></Card>}</div><div className={bookingTab === "customer" ? "" : "hidden"}>{customerContent}</div><div className={bookingTab === "costs" ? "" : "hidden"}><BookingCostsContent costs={detail.costs} status={status} /></div>
        </div>
      </div>
    </DashboardDetailLayout>;
  }

  if (detail.kind === "agency") {
    const agencyListQuery = agencyQuery ?? { month: query.month, search: query.agencySearch, page: query.agenciesPage, status: "confirmed", bookingSearch: "", bookingsPage: 1, sort: "updated-desc" as const };
    const agencyId = detail.agency.id ?? "unassigned";
    return <div className="mx-auto min-w-0 max-w-7xl space-y-5">
      <DashboardTaskHeader backHref={resolvedBackHref} backLabel={backLabel} description="รายละเอียดเอเจนซี่" title={detail.agency.name} />
      <section aria-label="สรุปยอดเอเจนซี่" className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <AgencySummaryMetric accent="blue" className="col-span-2 md:col-span-1" description="รายการติดจองในช่วงที่เลือก" icon={BarChart3Icon} label="ยอดขาย" visual={<svg className="size-20" viewBox="0 0 80 48" fill="none"><path d="M2 42C18 40 20 17 35 27S53 43 76 6" stroke="currentColor" strokeWidth="2" /><path d="M69 6h7v7" stroke="currentColor" strokeWidth="2" /></svg>}>{dashboardMoney(detail.agency.amountCents)}</AgencySummaryMetric>
        <AgencySummaryMetric accent="green" compactMobile description="เฉพาะรายการติดจองในช่วงที่เลือก ก่อนกรองรายการ" icon={CalendarDaysIcon} label="จำนวนการจองติดจอง" visual={<div className="flex h-10 items-end gap-1"><i className="h-3 w-2 rounded bg-current" /><i className="h-5 w-2 rounded bg-current" /><i className="h-7 w-2 rounded bg-current" /><i className="h-10 w-2 rounded bg-current" /></div>}>{detail.agency.count} รายการ</AgencySummaryMetric>
        <AgencySummaryMetric accent="orange" compactMobile description="เทียบยอดขายติดจองทั้งหมดในช่วงเดียวกัน" icon={PieChartIcon} label="สัดส่วนยอดขาย" visual={<div className="size-12 rounded-full bg-current [clip-path:polygon(50%_50%,50%_0,100%_0,100%_50%)]" />}>{detail.sharePercent === null ? "—" : `${detail.sharePercent.toFixed(1)}%`}</AgencySummaryMetric>
        {detail.agency.missingPrices > 0 && <p role="status" className="md:col-span-3 text-sm text-muted-foreground">การจองติดจอง {detail.agency.missingPrices} รายการยังไม่ระบุยอด</p>}
      </section>
      <section className="space-y-3"><h2 className="font-medium">รายการจอง</h2><BookingsList bookingHref={bookingId => dashboardAgencyBookingDetailHref(agencyListQuery, agencyId, bookingId)} href={changes => dashboardAgencyDetailHref(agencyListQuery, agencyId, changes)} query={dashboardAgencyDetailBookingQuery(agencyListQuery)} report={report} /></section>
    </div>;
  }

  return <DashboardHouseDetailView backHref={resolvedBackHref} backLabel={backLabel} detail={detail} houseDetailReturnTo={houseDetailReturnTo} query={query} />;
}
