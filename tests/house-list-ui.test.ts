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
    assert.match(source, /export function HouseList\(\{ houses, returnTo \}/);
    assert.match(source, /href=\{imageHref\(propertyId, returnTo\)\}/);
  });

  it("uses a single overflow menu for house row actions", () => {
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
    assert.doesNotMatch(source, /<Button asChild className="w-full">/);
  });

  it("places the mobile overflow menu after the zone instead of the status", () => {
    const mobileHeaderSource = mobileListSource.slice(
      mobileListSource.indexOf("<CardHeader"),
      mobileListSource.indexOf("</CardHeader>"),
    );
    const mobileZoneIconIndex = mobileListSource.indexOf("<MapPinHouse");
    const mobileZoneSource = mobileListSource.slice(
      mobileListSource.lastIndexOf("<dd", mobileZoneIconIndex),
      mobileListSource.indexOf("</dl>"),
    );

    assert.match(
      mobileListSource,
      /<div className="grid grid-cols-\[1fr_1fr_minmax\(0,1fr\)_auto\] gap-2 text-xs text-muted-foreground">/,
    );
    assert.match(mobileListSource, /<dl className="contents">/);
    assert.match(mobileHeaderSource, /<StatusBadge active=\{house\.is_active\} \/>/);
    assert.doesNotMatch(mobileHeaderSource, /HouseActionsMenu/);
    assert.doesNotMatch(mobileZoneSource, /HouseActionsMenu/);
    assert.match(
      mobileListSource,
      /<\/dl>\s*<div className="flex items-end justify-end self-end">\s*<HouseActionsMenu propertyId=\{house\.property_id\} returnTo=\{returnTo\} \/>/,
    );
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
