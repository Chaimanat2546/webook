import { BanknoteIcon, HouseIcon, SaveIcon, SparklesIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "../../../../components/ui/button";
import { HouseDetailCombobox } from "../../../../components/admin/houses/house-detail-combobox";
import { HouseDetailSectionNav } from "../../../../components/admin/houses/house-detail-section-nav";
import { HouseDetailSaveNotification } from "../../../../components/admin/houses/house-detail-save-notification";
import { HouseTaskHeader } from "../../../../components/admin/houses/house-task-header";
import { HouseWorkspaceShell } from "../../../../components/admin/houses/house-workspace-shell";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Textarea } from "../../../../components/ui/textarea";
import {
  PRIVATE_POOL_TYPE_OPTIONS,
  formatListingFacilityTitle,
} from "../../../../lib/listing-facilities";
import { ZONE_OPTIONS } from "../../../../lib/house-zones";
import {
  canManageHousePrices,
  canManageHouseRating,
  canUseAccommodation,
  canViewHousePrices,
  requireAdmin,
} from "../../../../server/auth/admin";
import {
  getFacilities,
  getListingFacilitiesByListingId,
  getListingByPropertyId,
  getListingPricesByListingId,
  type ListingFacilityRow,
  type ListingPriceRow,
} from "../../../../server/repositories/listings";
import {
  LISTING_PRICE_DAYS,
  canEditListingFacilityMessage,
} from "../../../../server/services/houses";
import { saveHouseDetailsAction, saveHouseFacilitiesAction, saveHousePricesAction } from "./actions";

const HOUSE_DETAIL_SECTIONS = [
  { key: "details", label: "ข้อมูลบ้าน" },
  { key: "prices", label: "ราคาพื้นฐาน" },
  { key: "facilities", label: "สิ่งอำนวยความสะดวก" },
] as const;

const HOUSE_DETAILS_FORM_ID = "house-details-form";
const HOUSE_PRICES_FORM_ID = "house-prices-form";
const HOUSE_FACILITIES_FORM_ID = "house-facilities-form";

const RATING_OPTIONS = [
  { label: "0 - กรุณาเลือก", value: "0" },
  { label: "1 - รีเช็คก่อนโอนบ้านไม่เหลือค่อยส่ง", value: "1" },
  { label: "2 - บ้านเก่าโทรมห้ามส่ง", value: "2" },
  { label: "3 - บ้านเก่าแต่พอส่งได้", value: "3" },
  { label: "4 - ส่งได้ต่อราคาง่าย", value: "4" },
  { label: "5 - ส่งได้เลยบ้านใหม่", value: "5" },
];

const TIME_OPTIONS = [
  { label: "ไม่ระบุ", value: "" },
  ...Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30;
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    return { label: value, value };
  }),
];

type HouseDetailSectionKey = (typeof HOUSE_DETAIL_SECTIONS)[number]["key"];

const sectionIconByKey: Record<HouseDetailSectionKey, LucideIcon> = {
  details: HouseIcon,
  prices: BanknoteIcon,
  facilities: SparklesIcon,
};

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

function saveToastTitle(searchParams: { saved?: string; section?: string }): string | null {
  if (searchParams.saved !== "1") return null;
  if (searchParams.section === "prices") return "บันทึกราคาพื้นฐานแล้ว";
  if (searchParams.section === "facilities") return "บันทึกสิ่งอำนวยความสะดวกแล้ว";
  return "บันทึกข้อมูลบ้านแล้ว";
}

function inputValue(value: number | string | null | undefined): number | string {
  return value ?? "";
}

function priceForDay(prices: ListingPriceRow[], dayOfWeek: number): ListingPriceRow | undefined {
  return prices.find((price) => price.day_of_week === dayOfWeek);
}

function facilityFor(
  facilities: ListingFacilityRow[],
  facilityId: string,
): ListingFacilityRow | undefined {
  return facilities.find((facility) => facility.facility_id === facilityId);
}

function timeValue(value: string | null | undefined): string {
  return value?.slice(0, 5) ?? "";
}

function getTimeOptions(value: string | null | undefined) {
  const current = timeValue(value);
  if (!current || TIME_OPTIONS.some((option) => option.value === current)) return TIME_OPTIONS;

  return [{ label: current, value: current }, ...TIME_OPTIONS];
}

function ratingValue(value: number | null | undefined): string {
  return value !== null && value !== undefined ? String(value) : "0";
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
  const toastTitle = saveToastTitle({ saved, section });
  const { adminUser, supabase } = await requireAdmin();
  const canManageAccommodation = canUseAccommodation(adminUser);
  const canViewPrices = canViewHousePrices(adminUser);
  const canManagePrices = canManageHousePrices(adminUser);
  if (selectedSection === "prices" && !canViewPrices) notFound();
  if (selectedSection !== "prices" && !canManageAccommodation) notFound();

  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const prices = await getListingPricesByListingId(supabase, house.id);
  const facilities = selectedSection === "facilities" ? await getFacilities(supabase) : [];
  const listingFacilities = await getListingFacilitiesByListingId(supabase, house.id);
  const messageFacilities = facilities.filter((facility) => canEditListingFacilityMessage(facility.name));
  const standardFacilities = facilities.filter((facility) => !canEditListingFacilityMessage(facility.name));
  const activeFacilityCount = listingFacilities.filter((facility) => facility.value_boolean === true).length;
  const sectionBadges: Record<HouseDetailSectionKey, string> = {
    details: "ข้อมูล",
    prices: `${LISTING_PRICE_DAYS.length} วัน`,
    facilities: `${activeFacilityCount} เปิด`,
  };
  const detailSections = HOUSE_DETAIL_SECTIONS.filter((item) =>
    item.key === "prices" ? canViewPrices : canManageAccommodation,
  ).map((item) => ({
    ...item,
    badge: sectionBadges[item.key],
  }));
  const activeSection =
    HOUSE_DETAIL_SECTIONS.find((item) => item.key === selectedSection) ?? HOUSE_DETAIL_SECTIONS[0];
  const detailsAction = saveHouseDetailsAction.bind(null, propertyId);
  const facilitiesAction = saveHouseFacilitiesAction.bind(null, propertyId);
  const canManageRating = canManageHouseRating(adminUser);
  const ActiveSectionIcon = sectionIconByKey[activeSection.key];
  const ratingAction = (
    <div className="grid gap-1">
      <Label htmlFor="rating">เรตติ้ง</Label>
      <HouseDetailCombobox
        defaultValue={ratingValue(house.rating)}
        emptyText="ไม่พบเรตติ้ง"
        form={HOUSE_DETAILS_FORM_ID}
        id="rating"
        name="rating"
        disabled={!canManageRating}
        options={RATING_OPTIONS}
        placeholder="เลือกเรตติ้ง"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6.5rem)] lg:min-h-0 lg:gap-4">
      {toastTitle ? <HouseDetailSaveNotification title={toastTitle} /> : null}

      <HouseTaskHeader
        backHref={backHref}
        propertyId={house.property_id}
        subtitle="จัดการข้อมูลบ้านพัก"
        title={house.title || "ไม่พบชื่อบ้านพัก"}
      />

      <HouseWorkspaceShell
        contentActions={activeSection.key === "details" ? ratingAction : undefined}
        contentIcon={<ActiveSectionIcon aria-hidden />}
        contentMeta={sectionBadges[activeSection.key]}
        contentTitle={activeSection.label}
        sidebar={
          <HouseDetailSectionNav
            propertyId={propertyId}
            returnTo={safeReturnTo}
            sections={detailSections}
            selectedSection={selectedSection}
          />
        }
        sidebarTitle="หมวดข้อมูล"
      >
            {activeSection.key === "details" ? (
              <form action={detailsAction} className="flex flex-col gap-5" id={HOUSE_DETAILS_FORM_ID}>
                <input name="returnTo" type="hidden" value={safeReturnTo ?? ""} />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="title">ชื่อบ้าน</Label>
                    <Input
                      defaultValue={inputValue(house.title)}
                      id="title"
                      name="title"
                      required
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
                    <Label htmlFor="checkin_time">เวลาเช็คอิน</Label>
                    <HouseDetailCombobox
                      defaultValue={timeValue(house.checkin_time)}
                      emptyText="ไม่พบเวลาเช็คอิน"
                      id="checkin_time"
                      name="checkin_time"
                      options={getTimeOptions(house.checkin_time)}
                      placeholder="เลือกเวลาเช็คอิน"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkout_time">เวลาเช็คเอาต์</Label>
                    <HouseDetailCombobox
                      defaultValue={timeValue(house.checkout_time)}
                      emptyText="ไม่พบเวลาเช็คเอาต์"
                      id="checkout_time"
                      name="checkout_time"
                      options={getTimeOptions(house.checkout_time)}
                      placeholder="เลือกเวลาเช็คเอาต์"
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
            ) : activeSection.key === "prices" ? (
              canViewPrices && !canManagePrices ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {LISTING_PRICE_DAYS.map((day) => {
                    const price = priceForDay(prices, day.dayOfWeek);

                    return (
                      <div className="grid gap-2 rounded-md border p-3" key={day.dayOfWeek}>
                        <h3 className="text-sm font-semibold">{day.label}</h3>
                        <div className="grid gap-1">
                          <span className="text-sm text-muted-foreground">ราคาขาย Agency</span>
                          <p className="text-lg font-semibold">{inputValue(price?.agency_price)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <form action={saveHousePricesAction.bind(null, propertyId)} className="flex flex-col gap-4 lg:min-h-full" id={HOUSE_PRICES_FORM_ID}>
                  <input name="returnTo" type="hidden" value={safeReturnTo ?? ""} />

                  <div className="grid gap-3 md:grid-cols-2">
                    {LISTING_PRICE_DAYS.map((day) => {
                      const price = priceForDay(prices, day.dayOfWeek);
                      const devilleId = `deville_price_${day.dayOfWeek}`;
                      const agencyId = `agency_price_${day.dayOfWeek}`;

                      return (
                        <div
                          className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(9rem,1fr)_minmax(0,12rem)_minmax(0,12rem)] md:items-end"
                          key={day.dayOfWeek}
                        >
                          <div>
                            <h3 className="text-sm font-semibold">{day.label}</h3>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={devilleId}>ราคาขาย Deville</Label>
                            <Input
                              defaultValue={inputValue(price?.deville_price)}
                              id={devilleId}
                              inputMode="numeric"
                              min={0}
                              name={`deville_price_${day.dayOfWeek}`}
                              type="number"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={agencyId}>ราคาขาย Agency</Label>
                            <Input
                              defaultValue={inputValue(price?.agency_price)}
                              id={agencyId}
                              inputMode="numeric"
                              min={0}
                              name={`agency_price_${day.dayOfWeek}`}
                              type="number"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end border-t pt-4 lg:mt-auto">
                    <Button className="w-full sm:w-fit" type="submit">
                      <SaveIcon data-icon="inline-start" />
                      บันทึกราคาพื้นฐาน
                    </Button>
                  </div>
                </form>
              )
            ) : activeSection.key === "facilities" ? (
              <form
                action={facilitiesAction}
                className="flex flex-col gap-4 lg:min-h-full"
                id={HOUSE_FACILITIES_FORM_ID}
              >
                <input name="returnTo" type="hidden" value={safeReturnTo ?? ""} />

                <div className="grid gap-5">
                  {facilities.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      ยังไม่มีรายการสิ่งอำนวยความสะดวก
                    </div>
                  ) : (
                    <>
                      {messageFacilities.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {messageFacilities.map((facility) => {
                            const listingFacility = facilityFor(listingFacilities, facility.id);
                            const facilityName = `facility_${facility.id}`;
                            const facilityId = `facility-${facility.id}`;
                            const messageName = `facility_message_${facility.id}`;
                            const messageId = `facility-message-${facility.id}`;
                            const isPrivatePool = facility.name === "private_pool";

                            return (
                              <div className="grid gap-3 rounded-md border p-3" key={facility.id}>
                                <label className="flex items-start gap-3 text-sm" htmlFor={facilityId}>
                                  <input name={facilityName} type="hidden" value="0" />
                                  <Switch
                                    defaultChecked={listingFacility?.value_boolean === true}
                                    id={facilityId}
                                    name={facilityName}
                                    value="1"
                                  />
                                  <span className="grid gap-1">
                                    <span className="font-medium">{formatListingFacilityTitle(facility)}</span>
                                    <span className="text-muted-foreground">
                                      ระบุเงื่อนไขเพิ่มเติมได้
                                    </span>
                                  </span>
                                </label>

                                {isPrivatePool ? (
                                  <div className="grid gap-2">
                                    <Label htmlFor={messageId}>ประเภทสระ</Label>
                                    <HouseDetailCombobox
                                      defaultValue={listingFacility?.message ?? ""}
                                      emptyText="ไม่พบประเภทสระ"
                                      id={messageId}
                                      name={messageName}
                                      options={PRIVATE_POOL_TYPE_OPTIONS}
                                      placeholder="เลือกประเภทสระ"
                                    />
                                  </div>
                                ) : (
                                  <div className="grid gap-2">
                                    <Label htmlFor={messageId}>เงื่อนไขเพิ่มเติม</Label>
                                    <Textarea
                                      className="min-h-20"
                                      defaultValue={listingFacility?.message ?? ""}
                                      id={messageId}
                                      name={messageName}
                                      placeholder="เช่น เงื่อนไขสัตว์เลี้ยง"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        {standardFacilities.map((facility) => {
                          const listingFacility = facilityFor(listingFacilities, facility.id);
                          const facilityName = `facility_${facility.id}`;
                          const facilityId = `facility-${facility.id}`;

                          return (
                            <label
                              className="flex min-h-16 items-start gap-3 rounded-md border p-3 text-sm"
                              htmlFor={facilityId}
                              key={facility.id}
                            >
                              <input name={facilityName} type="hidden" value="0" />
                              <Switch
                                defaultChecked={listingFacility?.value_boolean === true}
                                id={facilityId}
                                name={facilityName}
                                value="1"
                              />
                              <span className="font-medium leading-5">{formatListingFacilityTitle(facility)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end border-t pt-4 lg:mt-auto">
                  <Button className="w-full sm:w-fit" type="submit">
                    <SaveIcon data-icon="inline-start" />
                    บันทึกสิ่งอำนวยความสะดวก
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                ไม่พบหมวดข้อมูลนี้
              </div>
            )}
      </HouseWorkspaceShell>
    </div>
  );
}
