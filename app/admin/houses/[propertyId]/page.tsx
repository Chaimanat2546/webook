import { ArrowLeftIcon, ImageIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../../components/ui/empty";
import { HouseDetailCombobox } from "../../../../components/admin/houses/house-detail-combobox";
import { HouseTimeSelect } from "../../../../components/admin/houses/house-time-select";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { ScrollArea, ScrollBar } from "../../../../components/ui/scroll-area";
import { Switch } from "../../../../components/ui/switch";
import { Textarea } from "../../../../components/ui/textarea";
import { ZONE_OPTIONS } from "../../../../lib/house-zones";
import { canUseAccommodation, requireAdmin } from "../../../../server/auth/admin";
import { getListingByPropertyId } from "../../../../server/repositories/listings";
import { formatHouseActiveStatus } from "../../../../server/services/houses";
import { saveHouseDetailsAction } from "./actions";

const HOUSE_DETAIL_SECTIONS = [
  { badge: "ข้อมูล", key: "details", label: "ข้อมูลบ้าน" },
  { badge: "7 วัน", key: "prices", label: "ราคาพื้นฐาน" },
  { badge: "0 เปิด", key: "facilities", label: "สิ่งอำนวยความสะดวก" },
] as const;

type HouseDetailSectionKey = (typeof HOUSE_DETAIL_SECTIONS)[number]["key"];

function getSafeReturnTo(value?: string): string | null {
  if (value === "/admin/houses" || value?.startsWith("/admin/houses?")) {
    return value;
  }

  return null;
}

function getSelectedSection(value?: string): HouseDetailSectionKey {
  return HOUSE_DETAIL_SECTIONS.some((section) => section.key === value)
    ? (value as HouseDetailSectionKey)
    : "details";
}

function sectionHref(propertyId: string, section: HouseDetailSectionKey, returnTo?: string | null) {
  const params = new URLSearchParams({ section });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

function imageHref(propertyId: string, returnTo?: string | null) {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return `/admin/houses/${encodeURIComponent(propertyId)}/images${query ? `?${query}` : ""}`;
}

function inputValue(value: number | string | null | undefined): number | string {
  return value ?? "";
}

function timeValue(value: string | null | undefined): string {
  return value?.slice(0, 5) ?? "";
}

function locationZoneOptions(currentZone: string | null | undefined) {
  const options = [
    { label: "ไม่ระบุ", value: "" },
    ...ZONE_OPTIONS.filter((option) => option.value !== "all"),
  ];
  const current = currentZone?.trim();
  if (!current || options.some((option) => option.value === current)) return options;

  return [{ label: current, value: current }, ...options];
}

function propertyTypeOptions(currentType: string | null | undefined) {
  const options = [
    { label: "ไม่ระบุ", value: "" },
    { label: "พูลวิลล่า", value: "poolvilla" },
    { label: "คอนโด", value: "condo" },
  ];
  const current = currentType?.trim();
  if (!current || options.some((option) => option.value === current)) return options;

  return [{ label: current, value: current }, ...options];
}

export default async function HouseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ returnTo?: string; saved?: string; section?: string }>;
}) {
  const { propertyId } = await params;
  const { returnTo, saved, section } = await searchParams;
  const safeReturnTo = getSafeReturnTo(returnTo);
  const backHref = safeReturnTo ?? "/admin/houses";
  const selectedSection = getSelectedSection(section);
  const { adminUser, supabase } = await requireAdmin();

  if (!canUseAccommodation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดบ้านพัก</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_accommodation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const activeSection =
    HOUSE_DETAIL_SECTIONS.find((item) => item.key === selectedSection) ?? HOUSE_DETAIL_SECTIONS[0];
  const detailsAction = saveHouseDetailsAction.bind(null, propertyId);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Button asChild className="w-fit px-0" size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeftIcon data-icon="inline-start" />
              กลับไปบ้านพัก
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{house.title || "ไม่พบชื่อบ้านพัก"}</h1>
              <Badge variant="secondary">DV-{house.property_id}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatHouseActiveStatus(house.is_active)} · {activeSection.label}
            </p>
          </div>
        </div>
        <Button asChild className="w-fit" size="sm" variant="outline">
          <Link href={imageHref(propertyId, safeReturnTo)}>
            <ImageIcon data-icon="inline-start" />
            จัดการรูป
          </Link>
        </Button>
      </header>

      <div className="grid min-h-0 overflow-hidden rounded-lg border lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">หมวดข้อมูล</h2>
          </div>
          <ScrollArea className="w-full min-w-0 lg:h-full">
            <nav
              aria-label="House detail sections"
              className="flex w-max min-w-full gap-2 p-3 lg:w-auto lg:min-w-0 lg:flex-col"
            >
              {HOUSE_DETAIL_SECTIONS.map((item) => {
                const isActive = item.key === selectedSection;

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "flex min-w-44 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                      isActive ? "bg-primary text-primary-foreground hover:bg-primary" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    href={sectionHref(propertyId, item.key, safeReturnTo)}
                    key={item.key}
                  >
                    <span className="block min-w-0 truncate font-medium">{item.label}</span>
                    <Badge className="shrink-0" variant={isActive ? "secondary" : "outline"}>
                      {item.badge}
                    </Badge>
                  </Link>
                );
              })}
            </nav>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </aside>

        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <header className="border-b bg-muted/20 px-4 py-3">
            <h2 className="text-base font-semibold">{activeSection.label}</h2>
          </header>
          <div className="min-h-0 overflow-y-auto p-4">
            {activeSection.key === "details" ? (
              <form action={detailsAction} className="flex flex-col gap-5">
                <input name="returnTo" type="hidden" value={safeReturnTo ?? ""} />

                {saved === "1" ? (
                  <div
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    role="status"
                  >
                    บันทึกข้อมูลบ้านแล้ว
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="title">ชื่อบ้าน</Label>
                    <Input
                      defaultValue={inputValue(house.title)}
                      id="title"
                      name="title"
                      type="text"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="owner_id">เจ้าของบ้าน</Label>
                    <Input
                      disabled
                      defaultValue={inputValue(house.owner_id)}
                      id="owner_id"
                      min={0}
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="property_type">ประเภทบ้าน</Label>
                    <HouseDetailCombobox
                      defaultValue={house.property_type ?? ""}
                      emptyText="ไม่พบประเภทบ้าน"
                      id="property_type"
                      name="property_type"
                      options={propertyTypeOptions(house.property_type)}
                      placeholder="เลือกประเภทบ้าน"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location_zone">โซน</Label>
                    <HouseDetailCombobox
                      defaultValue={house.location_zone ?? ""}
                      emptyText="ไม่พบโซน"
                      id="location_zone"
                      name="location_zone"
                      options={locationZoneOptions(house.location_zone)}
                      placeholder="เลือกโซน"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bedrooms">ห้องนอน</Label>
                    <Input
                      defaultValue={inputValue(house.bedrooms)}
                      id="bedrooms"
                      min={0}
                      name="bedrooms"
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bathrooms">ห้องน้ำ</Label>
                    <Input
                      defaultValue={inputValue(house.bathrooms)}
                      id="bathrooms"
                      min={0}
                      name="bathrooms"
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="extra_beds">ราคาเตียงเสริม</Label>
                    <Input
                      defaultValue={inputValue(house.extra_beds)}
                      id="extra_beds"
                      min={0}
                      name="extra_beds"
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="max_guests">จำนวนผู้เข้าพักสูงสุด</Label>
                    <Input
                      defaultValue={inputValue(house.max_guests)}
                      id="max_guests"
                      min={1}
                      name="max_guests"
                      required
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="rating">เรตติ้ง</Label>
                    <Input
                      disabled
                      defaultValue={inputValue(house.rating)}
                      id="rating"
                      min={0}
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="insurance_fee">ค่าประกัน</Label>
                    <Input
                      defaultValue={inputValue(house.insurance_fee)}
                      id="insurance_fee"
                      min={0}
                      name="insurance_fee"
                      type="number"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkin_time_hour">เวลาเช็คอิน</Label>
                    <HouseTimeSelect
                      defaultValue={timeValue(house.checkin_time)}
                      id="checkin_time"
                      label="เวลาเช็คอิน"
                      name="checkin_time"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkout_time_hour">เวลาเช็คเอาต์</Label>
                    <HouseTimeSelect
                      defaultValue={timeValue(house.checkout_time)}
                      id="checkout_time"
                      label="เวลาเช็คเอาต์"
                      name="checkout_time"
                    />
                  </div>

                  <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="notes">โน้ตภายใน</Label>
                    <Textarea
                      className="min-h-24"
                      defaultValue={house.notes ?? ""}
                      id="notes"
                      name="notes"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-start gap-3 text-sm">
                    <input name="is_active" type="hidden" value="0" />
                    <Switch
                      defaultChecked={house.is_active === true}
                      id="is_active"
                      name="is_active"
                      value="1"
                    />
                    <span className="grid gap-1">
                      <span className="font-medium">เปิดใช้งานบ้านนี้</span>
                      <span className="text-muted-foreground">ปิดไว้เมื่อต้องการซ่อนจากระบบขาย</span>
                    </span>
                  </label>
                  <Button className="w-full sm:w-fit" type="submit">
                    <SaveIcon data-icon="inline-start" />
                    บันทึกข้อมูลบ้าน
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                {activeSection.key === "prices"
                  ? "MVP 2 จะเปิดแก้ไขราคาพื้นฐาน 7 วันในหมวดนี้"
                  : "MVP 3 จะเปิดแก้ไขสิ่งอำนวยความสะดวกในหมวดนี้"}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
