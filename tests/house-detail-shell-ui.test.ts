import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageUrl = new URL("../app/admin/houses/[propertyId]/page.tsx", import.meta.url);
const notificationUrl = new URL(
  "../components/admin/houses/house-detail-save-notification.tsx",
  import.meta.url,
);
const sectionNavUrl = new URL(
  "../components/admin/houses/house-detail-section-nav.tsx",
  import.meta.url,
);
const activeScrollUrl = new URL("../lib/scroll-active-item.ts", import.meta.url);
const taskHeaderUrl = new URL(
  "../components/admin/houses/house-task-header.tsx",
  import.meta.url,
);
const workspaceShellUrl = new URL(
  "../components/admin/houses/house-workspace-shell.tsx",
  import.meta.url,
);
const navItemUrl = new URL(
  "../components/admin/houses/house-workspace-nav-item.tsx",
  import.meta.url,
);

describe("house detail shell UI", () => {
  it("provides a zone-style section shell for house management", () => {
    assert.equal(existsSync(pageUrl), true);

    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /HOUSE_DETAIL_SECTIONS/);
    assert.match(source, /key: "details"/);
    assert.match(source, /key: "prices"/);
    assert.match(source, /key: "facilities"/);
    assert.match(source, /selectedSection/);
    assert.match(source, /HouseDetailSectionNav/);
    assert.match(source, /จัดการข้อมูลบ้านพัก/);
    assert.match(source, /const sectionBadges: Record<HouseDetailSectionKey, string>/);
    assert.match(source, /HouseWorkspaceShell/);
    assert.doesNotMatch(source, /imageHref\(propertyId, safeReturnTo\)/);
  });

  it("uses the shared house workspace shell components", () => {
    const source = readFileSync(pageUrl, "utf8");
    const navSource = readFileSync(sectionNavUrl, "utf8");

    assert.equal(existsSync(taskHeaderUrl), true);
    assert.equal(existsSync(workspaceShellUrl), true);
    assert.equal(existsSync(navItemUrl), true);
    assert.match(source, /import \{ HouseTaskHeader \}/);
    assert.match(source, /import \{ HouseWorkspaceShell \}/);
    assert.match(source, /<HouseTaskHeader/);
    assert.match(source, /subtitle="จัดการข้อมูลบ้านพัก"/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle="หมวดข้อมูล"/);
    assert.match(source, /contentIcon=\{<ActiveSectionIcon aria-hidden \/>\}/);
    assert.match(source, /contentTitle=\{activeSection\.label\}/);
    assert.match(source, /contentMeta=\{sectionBadges\[activeSection\.key\]\}/);
    assert.match(source, /contentActions=\{activeSection\.key === "details" \? ratingAction : undefined\}/);
    assert.match(navSource, /HouseWorkspaceNavItem/);
  });

  it("keeps the mobile house detail shell compact", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /className="flex flex-col gap-3 lg:h-\[calc\(100dvh-6\.5rem\)\]/);
    assert.match(source, /<HouseTaskHeader/);
    assert.doesNotMatch(source, /className="hidden w-fit lg:inline-flex"/);
    assert.match(source, /subtitle="จัดการข้อมูลบ้านพัก"/);
    assert.doesNotMatch(source, /<p className="hidden text-sm text-muted-foreground lg:block">[\s\S]*formatHouseActiveStatus\(house\.is_active\)[\s\S]*activeSection\.label[\s\S]*<\/p>/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /className="flex flex-col gap-4 lg:min-h-full"/);
    assert.doesNotMatch(source, /order-first/);
    assert.doesNotMatch(source, /autoFocus=\{isActive\}/);
    assert.doesNotMatch(source, /<h2 className="text-sm font-semibold">หมวดข้อมูล<\/h2>/);
    assert.doesNotMatch(source, /className="flex min-h-full flex-col gap-4"/);
    assert.doesNotMatch(source, /imageHref\(propertyId, safeReturnTo\)/);
  });

  it("scrolls the selected mobile detail section into view without reordering sections", () => {
    assert.equal(existsSync(sectionNavUrl), true);

    const source = readFileSync(sectionNavUrl, "utf8");
    const scrollSource = readFileSync(activeScrollUrl, "utf8");

    assert.match(source, /"use client"/);
    assert.match(source, /import \{ BanknoteIcon, HouseIcon, SparklesIcon \} from "lucide-react";/);
    assert.match(source, /import \{ scrollActiveItemToStart \} from "\.\.\/\.\.\/\.\.\/lib\/scroll-active-item";/);
    assert.match(source, /import \{ HouseWorkspaceNavItem \} from "\.\/house-workspace-nav-item";/);
    assert.match(source, /const sectionIconByKey: Record<string, LucideIcon>/);
    assert.match(source, /details: HouseIcon/);
    assert.match(source, /prices: BanknoteIcon/);
    assert.match(source, /facilities: SparklesIcon/);
    assert.match(source, /readonly badge\?: string;/);
    assert.match(source, /const activeSectionRef = useRef<HTMLAnchorElement>\(null\);/);
    assert.match(source, /window\.matchMedia\("\(max-width: 1023px\)"\)\.matches/);
    assert.match(source, /scrollActiveItemToStart\(activeSection\);/);
    assert.match(source, /\}, \[selectedSection\]\);/);
    assert.match(source, /ref=\{isActive \? activeSectionRef : undefined\}/);
    assert.match(scrollSource, /closest\('\[data-slot="scroll-area-viewport"\]'\)/);
    assert.match(scrollSource, /getBoundingClientRect\(\)/);
    assert.match(
      scrollSource,
      /viewport\.scrollTo\(\{\s*behavior: "smooth",\s*left: viewport\.scrollLeft \+ itemRect\.left - viewportRect\.left,\s*\}\);/,
    );
    assert.doesNotMatch(source, /scrollIntoView/);
    assert.match(source, /badge=\{item\.badge\}/);
    assert.match(source, /const SectionIcon = sectionIconByKey\[item\.key\] \?\? HouseIcon;/);
    assert.match(source, /icon=\{<SectionIcon aria-hidden className="size-4 shrink-0" \/>\}/);
    assert.doesNotMatch(source, /order-first/);
  });

  it("renders the editable listing details form without forbidden fields", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /saveHouseDetailsAction/);
    assert.match(source, /saveHouseDetailsAction\.bind\(null, propertyId\)/);
    assert.match(source, /canManageHouseRating\(adminUser\)/);
    assert.match(source, /const canManageRating = canManageHouseRating\(adminUser\)/);
    assert.match(source, /HouseDetailCombobox/);
    assert.match(source, /Switch/);
    assert.match(source, /poolvilla/);
    assert.match(source, /พูลวิลล่า/);
    assert.match(source, /condo/);
    assert.match(source, /คอนโด/);
    assert.match(source, /ราคาเตียงเสริม/);
    assert.match(source, /0 - กรุณาเลือก/);
    assert.match(source, /1 - รีเช็คก่อนโอนบ้านไม่เหลือค่อยส่ง/);
    assert.match(source, /2 - บ้านเก่าโทรมห้ามส่ง/);
    assert.match(source, /3 - บ้านเก่าแต่พอส่งได้/);
    assert.match(source, /4 - ส่งได้ต่อราคาง่าย/);
    assert.match(source, /5 - ส่งได้เลยบ้านใหม่/);
    assert.match(source, /htmlFor="rating"[\s\S]{0,500}<HouseDetailCombobox/);
    assert.match(source, /id="rating"[\s\S]*name="rating"[\s\S]*disabled=\{!canManageRating\}/);
    assert.match(source, /const ratingAction = \(/);
    assert.match(source, /form=\{HOUSE_DETAILS_FORM_ID\}/);
    assert.match(source, /contentActions=\{activeSection\.key === "details" \? ratingAction : undefined\}/);
    assert.match(source, /TIME_OPTIONS/);
    assert.match(source, /Array\.from\(\{ length: 48 \}/);
    assert.match(source, /id="title"[\s\S]*name="title"[\s\S]*required/);
    assert.match(source, /htmlFor="checkin_time"[\s\S]{0,500}<HouseDetailCombobox/);
    assert.match(source, /htmlFor="checkout_time"[\s\S]{0,500}<HouseDetailCombobox/);
    assert.match(source, /id="checkin_time"[\s\S]*name="checkin_time"/);
    assert.match(source, /id="checkout_time"[\s\S]*name="checkout_time"/);
    assert.doesNotMatch(source, /HouseTimeSelect/);
    assert.doesNotMatch(source, /checkin_time_hour/);
    assert.doesNotMatch(source, /checkout_time_hour/);
    assert.doesNotMatch(source, /timeOptions/);
    assert.doesNotMatch(source, /type="time"/);
    assert.doesNotMatch(source, /lang="en-GB"/);

    for (const field of [
      "title",
      "bedrooms",
      "bathrooms",
      "extra_beds",
      "insurance_fee",
      "checkin_time",
      "checkout_time",
      "notes",
      "location_zone",
      "property_type",
      "rating",
      "max_guests",
      "is_active",
    ]) {
      assert.match(source, new RegExp(`name="${field}"`));
    }

    assert.doesNotMatch(source, /name="owner_id"/);
    assert.match(source, /disabled[\s\S]*id="owner_id"/);

    for (const field of ["property_id", "description", "property_tags", "sort_order"]) {
      assert.doesNotMatch(source, new RegExp(`name="${field}"`));
    }
  });

  it("shows a toast notification after house detail saves", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.equal(existsSync(notificationUrl), true);

    const notificationSource = readFileSync(notificationUrl, "utf8");

    assert.match(source, /HouseDetailSaveNotification/);
    assert.match(source, /saveToastTitle/);
    assert.match(source, /toastTitle/);
    assert.match(source, /<HouseDetailSaveNotification title=\{toastTitle\} \/>/);
    assert.doesNotMatch(source, /role="status"/);
    assert.doesNotMatch(source, /border-emerald-200/);
    assert.match(notificationSource, /"use client"/);
    assert.match(notificationSource, /from "sonner"/);
    assert.match(notificationSource, /toast\.success\(title\)/);
  });

  it("renders the weekly listing price form in the prices section", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /saveHousePricesAction/);
    assert.match(source, /saveHousePricesAction\.bind\(null, propertyId\)/);
    assert.match(source, /canManageHousePrices\(adminUser\)/);
    assert.match(source, /const canManagePrices = canManageHousePrices\(adminUser\)/);
    assert.match(source, /if \(selectedSection === "prices" && !canManagePrices\) notFound\(\);/);
    assert.match(source, /const detailSections = HOUSE_DETAIL_SECTIONS\.filter\(\(item\) => canManagePrices \|\| item\.key !== "prices"\)/);
    assert.match(source, /getListingPricesByListingId\(supabase, house\.id\)/);
    assert.match(source, /LISTING_PRICE_DAYS\.map/);
    assert.match(source, /\{day\.label\}/);
    assert.match(source, /<HouseWorkspaceShell/);
    assert.match(source, /<form action=\{pricesAction\} className="flex flex-col gap-4 lg:min-h-full"/);
    assert.match(source, /className="grid gap-3 md:grid-cols-2"/);
    assert.match(source, /className="flex justify-end border-t pt-4 lg:mt-auto"/);
    assert.doesNotMatch(source, /<p[^>]*>day_of_week =/);
    assert.match(source, /ราคาขาย Deville/);
    assert.doesNotMatch(source, /ราคาขายบริษัท/);
    assert.match(source, /ราคาขาย Agency/);
    assert.match(source, /name=\{`deville_price_\$\{day\.dayOfWeek\}`\}/);
    assert.match(source, /name=\{`agency_price_\$\{day\.dayOfWeek\}`\}/);
    assert.match(source, /disabled=\{!canManagePrices\}/);
    assert.match(source, /Button className="w-full sm:w-fit" disabled=\{!canManagePrices\} type="submit"/);
    assert.match(source, /ไม่มีสิทธิ์แก้ไขราคาพื้นฐาน/);
    assert.match(source, /activeSection\.key === "prices"/);
    assert.match(source, /HOUSE_PRICES_FORM_ID/);
  });

  it("renders the listing facilities form in the facilities section", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /saveHouseFacilitiesAction/);
    assert.match(source, /saveHouseFacilitiesAction\.bind\(null, propertyId\)/);
    assert.match(source, /getFacilities\(supabase\)/);
    assert.match(source, /getListingFacilitiesByListingId\(supabase, house\.id\)/);
    assert.match(source, /value_boolean === true/);
    assert.match(source, /formatListingFacilityTitle/);
    assert.match(source, /PRIVATE_POOL_TYPE_OPTIONS/);
    assert.match(source, /const messageFacilities = facilities\.filter/);
    assert.match(source, /const standardFacilities = facilities\.filter/);
    assert.match(source, /canEditListingFacilityMessage\(facility\.name\)/);
    assert.match(source, /const facilityName = `facility_\$\{facility\.id\}`/);
    assert.match(source, /const messageName = `facility_message_\$\{facility\.id\}`/);
    assert.match(source, /standardFacilities\.map/);
    assert.match(source, /messageFacilities\.map/);
    assert.match(source, /className="grid grid-cols-2 gap-3 lg:grid-cols-5"/);
    assert.doesNotMatch(source, /className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"/);
    assert.match(source, /<Switch[\s\S]*name=\{facilityName\}/);
    assert.match(source, /facility\.name === "private_pool"/);
    assert.match(source, /<HouseDetailCombobox[\s\S]*name=\{messageName\}/);
    assert.match(source, /<Textarea[\s\S]*name=\{messageName\}/);
    assert.match(source, /activeSection\.key === "facilities"/);
    assert.match(source, /HOUSE_FACILITIES_FORM_ID/);
  });
});
