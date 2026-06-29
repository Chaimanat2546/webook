import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("house image actions", () => {
  it("uploads new R2 images and deletes selected image records on save", () => {
    assert.ok(existsSync(new URL("../app/admin/houses/[propertyId]/images/actions.ts", import.meta.url)));

    const actionsSource = readFileSync(
      new URL("../app/admin/houses/[propertyId]/images/actions.ts", import.meta.url),
      "utf8",
    );
    const repositorySource = readFileSync(new URL("../server/repositories/images.ts", import.meta.url), "utf8");

    assert.match(actionsSource, /deleted_image_ids/);
    assert.match(actionsSource, /getImageFiles/);
    assert.match(actionsSource, /validateHouseImageFile/);
    assert.match(actionsSource, /validateHouseImageZone/);
    assert.match(actionsSource, /buildHouseImageName/);
    assert.match(actionsSource, /buildHouseImageUrl/);
    assert.match(actionsSource, /uploadHouseImageObject/);
    assert.match(actionsSource, /deleteHouseImageObject/);
    assert.match(actionsSource, /isHouseImageFileOperationAllowed/);
    assert.match(actionsSource, /canUseAccommodation\(adminUser\)/);
    assert.match(actionsSource, /Admin profile is incomplete/);
    assert.match(actionsSource, /create_by: adminCreateBy/);
    assert.doesNotMatch(actionsSource, /ADMIN_ROLE_ID/);
    assert.doesNotMatch(actionsSource, /LEGACY_SYSTEM_IMAGE_CREATE_BY/);
    assert.match(actionsSource, /insertHouseImages/);
    assert.match(actionsSource, /deleteHouseImageById/);
    assert.match(repositorySource, /const houseImageSelect =/);
    assert.match(repositorySource, /export async function getHouseImageById/);
    assert.match(repositorySource, /\.from\("images"\)[\s\S]*\.select\(houseImageSelect\)[\s\S]*\.eq\("id", id\)[\s\S]*\.maybeSingle\(\)/);
    assert.match(repositorySource, /export async function getHouseImagesByIds/);
    assert.match(repositorySource, /\.from\("images"\)[\s\S]*\.select\(houseImageSelect\)[\s\S]*\.in\("id", ids\)/);
    assert.match(repositorySource, /export async function insertHouseImages/);
    assert.match(repositorySource, /export async function deleteHouseImageById/);
  });
});
