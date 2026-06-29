import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  UNASSIGNED_IMAGE_ZONE,
  formatImageMoveLabel,
  formatThaiImageDateTime,
  getImageZoneMeta,
  buildHouseImageName,
  getImageFiles,
  getSelectedImageZoneGroup,
  groupImagesByZone,
  validateHouseImageFile,
  validateHouseImageZone,
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

describe("house image storage policy", () => {
  it("infers provider from image_url and keeps AWS/S3 mutations disabled for now", async () => {
    const imagesModule = await import("../server/services/images.ts");

    assert.equal(typeof imagesModule.isHouseImageFileOperationAllowed, "function");
    const isAllowed = imagesModule.isHouseImageFileOperationAllowed as (
      imageUrl: string | null,
      operation: string,
    ) => boolean;

    assert.equal(isAllowed("https://webook-media.example.workers.dev/houses/181/1.webp", "create"), true);
    assert.equal(isAllowed("https://webook-media.example.workers.dev/houses/181/1.webp", "replace"), true);
    assert.equal(isAllowed("https://webook-media.example.workers.dev/houses/181/1.webp", "delete"), true);
    assert.equal(
      isAllowed(
        "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa.webp",
        "create",
      ),
      false,
    );
    assert.equal(
      isAllowed(
        "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa.webp",
        "replace",
      ),
      false,
    );
    assert.equal(
      isAllowed(
        "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/villa.webp",
        "delete",
      ),
      false,
    );
    assert.equal(isAllowed(null, "delete"), false);
  });
});

describe("house image mutation rules", () => {
  it("validates files, zones, and builds R2 image names", async () => {
    const imagesModule = await import("../server/services/images.ts");
    assert.equal(typeof imagesModule.buildHouseImageObjectKey, "function");
    assert.equal(typeof imagesModule.resolveHouseImageObjectKey, "function");

    const image = new File([new Uint8Array([1])], "house.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.append("images", image);
    formData.append("images", new File([], "empty.webp", { type: "image/webp" }));
    const buildHouseImageObjectKey = imagesModule.buildHouseImageObjectKey as (
      propertyId: string,
      imageName: string,
    ) => string;
    const resolveHouseImageObjectKey = imagesModule.resolveHouseImageObjectKey as (
      propertyId: string,
      imageName: string,
    ) => string;

    assert.deepEqual(getImageFiles(formData, "images"), [image]);
    assert.equal(validateHouseImageFile(image), image);
    assert.equal(validateHouseImageZone(" bedroom "), "bedroom");
    assert.equal(
      buildHouseImageName("image/webp", {
        now: new Date("2026-02-22T13:59:10.000Z"),
        randomHex: "63fe3bcbc8",
      }),
      "20260222205910_63fe3bcbc8.webp",
    );
    assert.equal(
      buildHouseImageObjectKey("181", "20260222205910_63fe3bcbc8.webp"),
      "houses/181/20260222205910_63fe3bcbc8.webp",
    );
    assert.equal(
      resolveHouseImageObjectKey("181", "houses/181/legacy.webp"),
      "houses/181/legacy.webp",
    );
    assert.throws(
      () => validateHouseImageFile(new File(["x"], "house.txt", { type: "text/plain" })),
      /Unsupported image type/,
    );
    assert.throws(() => validateHouseImageZone("living_room"), /Invalid image zone/);
  });
});
