import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/houses/house-list.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(new URL("../app/admin/houses/page.tsx", import.meta.url), "utf8");
const paginationSource = readFileSync(
  new URL("../components/admin/houses/pagination.tsx", import.meta.url),
  "utf8",
);
const dropdownMenuPath = new URL("../components/ui/dropdown-menu.tsx", import.meta.url);
const dropdownMenuSource = existsSync(dropdownMenuPath)
  ? readFileSync(dropdownMenuPath, "utf8")
  : "";
const mobileListSource = source.slice(
  source.indexOf('<div className="flex flex-col gap-3 md:hidden">'),
  source.indexOf('<Card className="hidden p-0 md:block">'),
);

describe("house list table UI", () => {
  it("uses separate bedroom, bathroom, and zone columns instead of a details column", () => {
    assert.match(source, /<TableHead[^>]*>ห้องนอน<\/TableHead>/);
    assert.match(source, /<TableHead[^>]*>ห้องน้ำ<\/TableHead>/);
    assert.match(source, /<TableHead[^>]*>ทำเล\(zone\)<\/TableHead>/);
    assert.doesNotMatch(source, /<TableHead>รายละเอียด<\/TableHead>/);
  });
  it("passes the current list URL to image management links", () => {
    assert.match(source, /function imageHref\(propertyId: string, returnTo: string\)/);
    assert.match(source, /params\.set\("returnTo", returnTo\)/);
    assert.match(source, /export function HouseList\(\{/);
    assert.match(source, /href=\{imageHref\(propertyId, returnTo\)\}/);
  });

  it("shows only the permitted house actions with clear Thai labels", () => {
    assert.match(source, /canManageAccommodation: boolean/);
    assert.match(source, /canManagePrices: boolean/);
    assert.match(source, /canViewPrices: boolean/);
    assert.match(source, /section", "facilities"/);
    assert.match(source, /section", "prices"/);
    assert.match(source, /params\.set\("returnTo", returnTo\)/);
    assert.match(source, /\{canManageAccommodation \? \(/);
    assert.match(source, /\{canViewPrices \? \(/);
    assert.match(source, /canManagePrices \? "จัดการราคา" : "ดูราคาส่งเอเจนซี่"/);
    assert.match(source, /BadgeDollarSign/);
    assert.match(source, /BanknoteIcon/);
    assert.match(source, /SparklesIcon/);
    assert.match(source, /<SparklesIcon aria-hidden \/>/);
    assert.match(source, /canManagePrices \? <BadgeDollarSign aria-hidden \/> : <BanknoteIcon aria-hidden \/>/);
    assert.doesNotMatch(source, /CircleDollarSign/);
    assert.doesNotMatch(source, /Wrench/);
    assert.match(source, /สิ่งอำนวยความสะดวก/);
    assert.doesNotMatch(source, /cover-select/);
    assert.doesNotMatch(source, /เลือกรูปหน้าปก/);
    assert.match(source, /<HouseActionsMenu[\s\S]*canManageAccommodation=\{canManageAccommodation\}[\s\S]*canViewPrices=\{canViewPrices\}/);
    assert.match(pageSource, /requireHouseListAdmin/);
    assert.match(pageSource, /canManageAccommodation=\{canUseAccommodation\(adminUser\)\}/);
    assert.match(pageSource, /canManagePrices=\{canManageHousePrices\(adminUser\)\}/);
    assert.match(pageSource, /canViewPrices=\{canViewHousePrices\(adminUser\)\}/);
  });

  it("uses an overflow menu on desktop and a bottom sheet on mobile", () => {
    assert.match(source, /EllipsisVerticalIcon/);
    assert.match(source, /function houseHref\(propertyId: string, returnTo: string\)/);
    assert.match(source, /function HouseActionsMenu/);
    assert.ok(existsSync(dropdownMenuPath));
    assert.match(dropdownMenuSource, /DropdownMenuPrimitive\.Portal/);
    assert.match(source, /import \{ Button \} from "\.\.\/\.\.\/ui\/button";/);
    assert.match(source, /import \{[\s\S]*DropdownMenu[\s\S]*DropdownMenuContent[\s\S]*DropdownMenuGroup[\s\S]*DropdownMenuItem[\s\S]*DropdownMenuTrigger[\s\S]*\} from "\.\.\/\.\.\/ui\/dropdown-menu";/);
    assert.match(source, /<DropdownMenu modal=\{false\}>/);
    assert.match(source, /<DropdownMenuTrigger asChild>/);
    assert.match(source, /<DropdownMenuContent align="end"/);
    assert.match(source, /<DropdownMenuGroup>/);
    assert.match(source, /<DropdownMenuItem asChild>/);
    assert.match(source, /href=\{houseHref\(propertyId, returnTo\)\}/);
    assert.match(source, /href=\{imageHref\(propertyId, returnTo\)\}/);
    assert.doesNotMatch(source, /<details/);
    assert.doesNotMatch(source, /<summary/);
    assert.match(source, /import \{[\s\S]*Sheet[\s\S]*SheetContent[\s\S]*SheetHeader[\s\S]*SheetTitle[\s\S]*SheetTrigger[\s\S]*\} from "\.\.\/\.\.\/ui\/sheet";/);
    assert.match(source, /function HouseMobileActionsMenu/);
    assert.match(source, /<SheetContent side="bottom"/);
    assert.match(source, /<SheetTitle>จัดการบ้านพัก<\/SheetTitle>/);
    assert.match(source, /<SheetTrigger asChild>/);
    assert.match(source, /<Button className="w-full"/);
  });

  it("places a full-width mobile management button below the house details", () => {
    const mobileHeaderSource = mobileListSource.slice(
      mobileListSource.indexOf("<CardHeader"),
      mobileListSource.indexOf("</CardHeader>"),
    );

    assert.match(
      mobileListSource,
      /<div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">/,
    );
    assert.match(mobileListSource, /<dl className="contents">/);
    assert.match(mobileHeaderSource, /<StatusBadge active=\{house\.is_active\} \/>/);
    assert.doesNotMatch(mobileHeaderSource, /HouseActionsMenu/);
    assert.doesNotMatch(mobileListSource, /<HouseActionsMenu/);
    assert.match(mobileListSource, /<HouseMobileActionsMenu[\s\S]*propertyId=\{house\.property_id\}[\s\S]*returnTo=\{returnTo\}/);
  });

  it("uses Thai display helpers for zone and status values", () => {
    assert.match(source, /formatHouseActiveStatus/);
    assert.match(source, /formatHouseZone/);
    assert.match(source, /formatHouseActiveStatus\(active\)/);
    assert.match(source, /formatHouseZone\(house\.location_zone\)/);
    assert.doesNotMatch(source, />Active</);
    assert.doesNotMatch(source, />Inactive</);
  });

  it("keeps desktop table columns stable and truncates long text", () => {
    assert.match(source, /<Table className="table-fixed">/);
    assert.match(source, /<TableHead className="w-\[44%\]">/);
    assert.match(source, /<TableHead className="w-\[8%\]">ID<\/TableHead>/);
    assert.match(source, /<span className="block truncate">/);
    assert.match(source, /<TableCell className="truncate text-muted-foreground">/);
  });

  it("shows a submit button beside the house search input", () => {
    assert.match(pageSource, /import \{ SearchIcon \} from "lucide-react"/);
    assert.match(pageSource, /import \{ Button \} from "\.\.\/\.\.\/\.\.\/components\/ui\/button"/);
    assert.match(pageSource, /<form className="mb-4 flex gap-2 md:max-w-sm">/);
    assert.match(pageSource, /name="q"/);
    assert.match(pageSource, /<Button className="shrink-0" type="submit">/);
    assert.match(pageSource, /<SearchIcon aria-hidden className="size-4" \/>/);
    assert.match(pageSource, /<Button className="shrink-0" type="submit">[\s\S]*?ค้นหา[\s\S]*?<\/Button>/);
  });

  it("keeps pagination reusable for admin list pages", () => {
    assert.match(paginationSource, /basePath = "\/admin\/houses"/);
    assert.match(paginationSource, /return `\$\{basePath\}\?\$\{params\}`/);
  });
});
