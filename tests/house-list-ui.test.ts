import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert.match(source, /href=\{imageHref\(house\.property_id, returnTo\)\}/);
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
