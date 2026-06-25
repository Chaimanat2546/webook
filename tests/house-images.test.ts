import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UNASSIGNED_IMAGE_ZONE, groupImagesByZone } from "../server/services/images.ts";

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
});
