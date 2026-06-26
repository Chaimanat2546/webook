import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  UNASSIGNED_IMAGE_ZONE,
  formatImageMoveLabel,
  formatThaiImageDateTime,
  getImageZoneMeta,
  getSelectedImageZoneGroup,
  groupImagesByZone,
} from "../server/services/images.ts";

describe("house image grouping", () => {
  it("groups by image_zone and sorts folders by lowest global image_move", () => {
    const groups = groupImagesByZone([
      { id: 1, image_move: 4, image_name: "b.webp", image_zone: "bedroom" },
      { id: 2, image_move: 1, image_name: "c.webp", image_zone: "cover" },
      { id: 3, image_move: 2, image_name: "l.webp", image_zone: "living_room" },
      { id: 4, image_move: 3, image_name: "l2.webp", image_zone: "living_room" },
    ]);

    assert.deepEqual(groups.map((group) => group.zone), [
      "cover",
      "living_room",
      "bedroom",
    ]);
    assert.deepEqual(groups[1]?.images.map((image) => image.image_move), [2, 3]);
  });

  it("uses Thai unassigned label for empty zones", () => {
    const groups = groupImagesByZone([
      { id: 1, image_move: 9, image_name: "x.webp", image_zone: "" },
    ]);

    assert.equal(groups[0]?.zone, UNASSIGNED_IMAGE_ZONE);
    assert.equal(groups[0]?.zone, "ไม่ระบุหมวด");
  });

  it("formats image card metadata for Thai admins", () => {
    const formattedDate = formatThaiImageDateTime("2024-03-15T10:23:00.000Z");

    assert.equal(formatImageMoveLabel(2), "# 2");
    assert.equal(formatImageMoveLabel(null), "# -");
    assert.match(formattedDate, /15/);
    assert.match(formattedDate, /มี\.ค\./);
    assert.match(formattedDate, /2567/);
    assert.match(formattedDate, /17:23/);
    assert.equal(formatThaiImageDateTime(null), "-");
    assert.equal(formatThaiImageDateTime("not-a-date"), "-");
  });

  it("selects one image zone from a query value and falls back to the first zone", () => {
    const groups = groupImagesByZone([
      { id: 1, image_move: 1, image_name: "cover.webp", image_zone: "cover" },
      { id: 2, image_move: 2, image_name: "living.webp", image_zone: "living_room" },
    ]);

    assert.equal(getSelectedImageZoneGroup(groups, "living_room")?.zone, "living_room");
    assert.equal(getSelectedImageZoneGroup(groups, "missing")?.zone, "cover");
    assert.equal(getSelectedImageZoneGroup(groups, undefined)?.zone, "cover");
    assert.equal(getSelectedImageZoneGroup([], "cover"), null);
  });

  it("maps known image zones to Thai labels and lucide icon names", () => {
    assert.deepEqual(getImageZoneMeta("inside"), {
      icon: "armchair",
      key: "inside",
      label: "ภายใน",
    });
    assert.deepEqual(getImageZoneMeta("parking"), {
      icon: "car-front",
      key: "parking",
      label: "ที่จอดรถ",
    });
    assert.deepEqual(getImageZoneMeta("bathroom"), {
      icon: "bath",
      key: "bathroom",
      label: "ห้องน้ำ",
    });
    assert.deepEqual(getImageZoneMeta("bedroom"), {
      icon: "bed-double",
      key: "bedroom",
      label: "ห้องนอน",
    });
    assert.deepEqual(getImageZoneMeta("kitchen"), {
      icon: "cooking-pot",
      key: "kitchen",
      label: "ห้องครัว",
    });
    assert.deepEqual(getImageZoneMeta("review"), {
      icon: "message-circle-code",
      key: "review",
      label: "รีวิว",
    });
    assert.deepEqual(getImageZoneMeta("outside"), {
      icon: "door-closed",
      key: "outside",
      label: "ภายนอก",
    });
  });

  it("keeps unknown image zone labels readable with a fallback icon", () => {
    assert.deepEqual(getImageZoneMeta("cover"), {
      icon: "image",
      key: "cover",
      label: "cover",
    });
  });
});
