import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageUrl = new URL("../app/admin/houses/[propertyId]/page.tsx", import.meta.url);

describe("house detail shell UI", () => {
  it("provides a zone-style section shell for house management", () => {
    assert.equal(existsSync(pageUrl), true);

    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /HOUSE_DETAIL_SECTIONS/);
    assert.match(source, /key: "details"/);
    assert.match(source, /key: "prices"/);
    assert.match(source, /key: "facilities"/);
    assert.match(source, /selectedSection/);
    assert.match(source, /ScrollArea/);
    assert.match(source, /lg:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
    assert.match(source, /\/admin\/houses\/\$\{encodeURIComponent\(propertyId\)\}\/images/);
  });

  it("renders the editable listing details form without forbidden fields", () => {
    const source = readFileSync(pageUrl, "utf8");

    assert.match(source, /saveHouseDetailsAction/);
    assert.match(source, /saveHouseDetailsAction\.bind\(null, propertyId\)/);
    assert.match(source, /HouseDetailCombobox/);
    assert.match(source, /Switch/);
    assert.match(source, /poolvilla/);
    assert.match(source, /พูลวิลล่า/);
    assert.match(source, /condo/);
    assert.match(source, /คอนโด/);
    assert.match(source, /ราคาเตียงเสริม/);
    assert.match(source, /HouseTimeSelect/);
    assert.match(source, /htmlFor="checkin_time_hour"[\s\S]{0,500}<HouseTimeSelect/);
    assert.match(source, /htmlFor="checkout_time_hour"[\s\S]{0,500}<HouseTimeSelect/);
    assert.match(source, /id="checkin_time"[\s\S]*name="checkin_time"/);
    assert.match(source, /id="checkout_time"[\s\S]*name="checkout_time"/);
    assert.doesNotMatch(source, /timeOptions/);
    assert.doesNotMatch(source, /type="time"/);
    assert.doesNotMatch(source, /lang="en-GB"/);
    assert.doesNotMatch(source, /htmlFor="checkin_time"[\s\S]{0,500}<HouseDetailCombobox/);
    assert.doesNotMatch(source, /htmlFor="checkout_time"[\s\S]{0,500}<HouseDetailCombobox/);

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
      "max_guests",
      "is_active",
    ]) {
      assert.match(source, new RegExp(`name="${field}"`));
    }

    assert.doesNotMatch(source, /name="owner_id"/);
    assert.doesNotMatch(source, /name="rating"/);
    assert.match(source, /disabled[\s\S]*id="owner_id"/);
    assert.match(source, /disabled[\s\S]*id="rating"/);

    for (const field of ["property_id", "description", "property_tags", "sort_order"]) {
      assert.doesNotMatch(source, new RegExp(`name="${field}"`));
    }
  });
});
