import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOUSE_PAGE_SIZE,
  LISTING_PRICE_DAYS,
  LISTING_DETAIL_EDITABLE_FIELDS,
  LISTING_DETAIL_FORBIDDEN_FIELDS,
  canEditListingFacilityMessage,
  formatHouseActiveStatus,
  formatHouseZone,
  getPaginationItems,
  getPageRange,
  normalizeListingFacilityFormValues,
  normalizeListingPriceFormValues,
  normalizeListingDetailsFormValues,
  normalizeHouseSearch,
  sortActiveFirst,
  toListingPropertyIdSearchValue,
  toListingSearchFilter,
  toListingSearchPattern,
} from "../server/services/houses.ts";

const facilityLabelsUrl = new URL("../lib/listing-facilities.ts", import.meta.url);

describe("house listing rules", () => {
  it("uses 8 records per page", () => {
    assert.equal(HOUSE_PAGE_SIZE, 8);
    assert.deepEqual(getPageRange(1), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(3), { from: 16, to: 23 });
  });

  it("normalizes invalid pages to page 1", () => {
    assert.deepEqual(getPageRange(0), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(Number.NaN), { from: 0, to: 7 });
  });

  it("trims search text", () => {
    assert.equal(normalizeHouseSearch("  pool villa  "), "pool villa");
    assert.equal(normalizeHouseSearch("   "), "");
  });

  it("escapes wildcard search input for PostgREST ilike", () => {
    assert.equal(toListingSearchPattern("A_100%"), "A\\_100\\%");
    assert.equal(toListingSearchPattern("A),id.eq.1"), "A id.eq.1");
  });

  it("extracts property ids from DV-prefixed search text case-insensitively", () => {
    assert.equal(toListingPropertyIdSearchValue("DV-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("dv-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("dV-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("Dv-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("181"), "181");
    assert.equal(toListingPropertyIdSearchValue("DV-pool"), null);
  });

  it("builds listing search filters without applying ilike to property_id", () => {
    const filter = toListingSearchFilter("DV-181");

    assert.match(filter, /title\.ilike\.%DV-181%/);
    assert.match(filter, /location_zone\.ilike\.%DV-181%/);
    assert.match(filter, /property_id\.eq\.181/);
    assert.doesNotMatch(filter, /property_id\.ilike/);
  });

  it("sorts active houses first without losing inactive houses", () => {
    const houses = [
      { is_active: false, property_id: "B" },
      { is_active: true, property_id: "A" },
      { is_active: false, property_id: "C" },
    ];

    assert.deepEqual(sortActiveFirst(houses).map((house) => house.property_id), [
      "A",
      "B",
      "C",
    ]);
  });

  it("formats house zones with Thai labels and keeps unknown zones readable", () => {
    const zoneLabels = {
      bang_saen: "บางแสน",
      bang_saray: "บางเสร่",
      bangkok: "กรุงเทพ",
      bangsaray: "บางเสร่",
      bangsean: "บางแสน",
      hua_hin: "หัวหิน",
      huahin: "หัวหิน",
      jomtien: "จอมเทียน",
      khaoyai: "เขาใหญ่",
      pattaya: "พัทยา",
      rayong: "ระยอง",
      sattahip: "สัตหีบ",
    };

    for (const [zone, label] of Object.entries(zoneLabels)) {
      assert.equal(formatHouseZone(zone), label);
    }

    assert.equal(formatHouseZone("BANGSEAN"), "บางแสน");
    assert.equal(formatHouseZone("unknown-zone"), "unknown-zone");
    assert.equal(formatHouseZone(null), "-");
  });

  it("formats active status in Thai", () => {
    assert.equal(formatHouseActiveStatus(true), "ใช้งานอยู่");
    assert.equal(formatHouseActiveStatus(false), "ปิดใช้งาน");
    assert.equal(formatHouseActiveStatus(null), "ปิดใช้งาน");
  });

  it("allows updates only for approved listing detail fields", () => {
    assert.deepEqual(LISTING_DETAIL_EDITABLE_FIELDS, [
      "title",
      "bedrooms",
      "bathrooms",
      "extra_beds",
      "insurance_fee",
      "owner_id",
      "checkin_time",
      "checkout_time",
      "notes",
      "location_zone",
      "property_type",
      "rating",
      "max_guests",
      "is_active",
    ]);

    assert.deepEqual(LISTING_DETAIL_FORBIDDEN_FIELDS, [
      "property_id",
      "description",
      "property_tags",
      "sort_order",
    ]);
  });

  it("normalizes listing detail form values without leaking forbidden fields", () => {
    const values = normalizeListingDetailsFormValues({
      bathrooms: "",
      bedrooms: "4",
      checkin_time: "14:00",
      checkout_time: "11:30:00",
      description: "ignore me",
      extra_beds: "1",
      insurance_fee: "5000",
      is_active: "1",
      location_zone: " pattaya ",
      max_guests: "10",
      notes: "  เงื่อนไขเจ้าของบ้าน  ",
      owner_id: "12",
      property_id: "999",
      property_tags: "{}",
      property_type: " pool_villa ",
      rating: "5",
      sort_order: "1",
      title: "  Villa A  ",
    });

    assert.deepEqual(values, {
      bathrooms: null,
      bedrooms: 4,
      checkin_time: "14:00",
      checkout_time: "11:30",
      extra_beds: 1,
      insurance_fee: 5000,
      is_active: true,
      location_zone: "pattaya",
      max_guests: 10,
      notes: "เงื่อนไขเจ้าของบ้าน",
      owner_id: 12,
      property_type: "pool_villa",
      rating: 5,
      title: "Villa A",
    });
    assert.equal(Object.hasOwn(values, "property_id"), false);
    assert.equal(Object.hasOwn(values, "description"), false);
    assert.equal(Object.hasOwn(values, "property_tags"), false);
    assert.equal(Object.hasOwn(values, "sort_order"), false);
  });

  it("rejects invalid listing detail numbers and times", () => {
    assert.throws(
      () => normalizeListingDetailsFormValues({ max_guests: "0", title: "Villa A" }),
      /max_guests/,
    );
    assert.throws(
      () => normalizeListingDetailsFormValues({ checkin_time: "25:00", max_guests: "2", title: "Villa A" }),
      /checkin_time/,
    );
    assert.throws(
      () => normalizeListingDetailsFormValues({ bedrooms: "1.5", max_guests: "2", title: "Villa A" }),
      /bedrooms/,
    );
    assert.throws(
      () => normalizeListingDetailsFormValues({ max_guests: "2", rating: "6", title: "Villa A" }),
      /rating/,
    );
    assert.throws(
      () => normalizeListingDetailsFormValues({ max_guests: "2", title: " " }),
      /title/,
    );
  });

  it("maps listing price days from Monday to Sunday", () => {
    assert.deepEqual(LISTING_PRICE_DAYS, [
      { dayOfWeek: 0, label: "วันจันทร์" },
      { dayOfWeek: 1, label: "วันอังคาร" },
      { dayOfWeek: 2, label: "วันพุธ" },
      { dayOfWeek: 3, label: "วันพฤหัสบดี" },
      { dayOfWeek: 4, label: "วันศุกร์" },
      { dayOfWeek: 5, label: "วันเสาร์" },
      { dayOfWeek: 6, label: "วันอาทิตย์" },
    ]);
  });

  it("normalizes weekly listing prices without extra fields", () => {
    const values = normalizeListingPriceFormValues({
      agency_price_0: "12000",
      agency_price_1: "",
      base_guests_0: "99",
      day_of_week: "4",
      deville_price_0: "10000",
      deville_price_1: "11000",
      notes: "ignore me",
    });

    assert.deepEqual(values[0], {
      agency_price: 12000,
      day_of_week: 0,
      deville_price: 10000,
    });
    assert.deepEqual(values[1], {
      agency_price: null,
      day_of_week: 1,
      deville_price: 11000,
    });
    assert.equal(values.length, 7);
    assert.equal(Object.hasOwn(values[0], "base_guests"), false);
    assert.equal(Object.hasOwn(values[0], "notes"), false);
  });

  it("rejects invalid weekly listing prices", () => {
    assert.throws(() => normalizeListingPriceFormValues({ deville_price_0: "-1" }), /deville_price_0/);
    assert.throws(() => normalizeListingPriceFormValues({ agency_price_0: "10.5" }), /agency_price_0/);
  });

  it("normalizes listing facilities from the facilities master only", () => {
    const formData = new FormData();
    formData.append("facility_pool", "0");
    formData.append("facility_pool", "1");
    formData.append("facility_message_pool", "salt");
    formData.append("facility_pets", "0");
    formData.append("facility_message_pets", "pet note should clear when off");
    formData.append("facility_wifi", "1");
    formData.append("facility_message_wifi", "wifi notes are not editable");
    formData.append("facility_unknown", "1");

    const values = normalizeListingFacilityFormValues(formData, [
      { id: "pool", name: "private_pool" },
      { id: "pets", name: "pets" },
      { id: "wifi", name: "wifi" },
    ]);

    assert.deepEqual(values, [
      { facility_id: "pool", message: "salt", value_boolean: true },
      { facility_id: "pets", message: null, value_boolean: false },
      { facility_id: "wifi", message: null, value_boolean: true },
    ]);
    assert.equal(canEditListingFacilityMessage("pets"), true);
    assert.equal(canEditListingFacilityMessage("private_pool"), true);
    assert.equal(canEditListingFacilityMessage("wifi"), false);
    assert.equal(Object.hasOwn(values[0], "name"), false);
    assert.equal(Object.hasOwn(values[0], "title"), false);
  });

  it("rejects unknown private pool types", () => {
    assert.throws(
      () =>
        normalizeListingFacilityFormValues(
          { facility_pool: "1", facility_message_pool: "mineral" },
          [{ id: "pool", name: "private_pool" }],
        ),
      /facility_message_pool/,
    );
  });

  it("centralizes facility labels and private pool options in a lib", async () => {
    const { existsSync, readFileSync } = await import("node:fs");

    assert.equal(existsSync(facilityLabelsUrl), true);

    const source = readFileSync(facilityLabelsUrl, "utf8");
    assert.match(source, /formatListingFacilityTitle/);
    assert.match(source, /name === "wifi"[\s\S]*"Wifi"/);
    assert.match(source, /PRIVATE_POOL_TYPE_OPTIONS/);
    assert.match(source, /value: "salt"/);
    assert.match(source, /value: "chlorine"/);
  });

  it("collapses long pagination with ellipsis around the current page", () => {
    assert.deepEqual(getPaginationItems(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(getPaginationItems(8, 20), [1, "ellipsis", 7, 8, 9, "ellipsis", 20]);
    assert.deepEqual(getPaginationItems(2, 20), [1, 2, 3, 4, 5, "ellipsis", 20]);
    assert.deepEqual(getPaginationItems(19, 20), [1, "ellipsis", 16, 17, 18, 19, 20]);
  });
});
