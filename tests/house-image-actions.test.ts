import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("house image actions", () => {
  it("uses operation-specific server actions for immediate upload and confirmed delete", () => {
    assert.ok(existsSync(new URL("../app/admin/houses/[propertyId]/images/actions.ts", import.meta.url)));

    const actionsSource = readFileSync(
      new URL("../app/admin/houses/[propertyId]/images/actions.ts", import.meta.url),
      "utf8",
    );
    const repositorySource = readFileSync(new URL("../server/repositories/images.ts", import.meta.url), "utf8");

    assert.match(actionsSource, /export interface HouseImageUploadResult/);
    assert.match(actionsSource, /export interface HouseImageDeleteResult/);
    assert.match(actionsSource, /export interface HouseImageBulkDeleteResult/);
    assert.match(actionsSource, /export async function uploadHouseImagesAction/);
    assert.match(actionsSource, /export async function deleteHouseImageAction/);
    assert.match(actionsSource, /export async function deleteHouseImagesAction/);
    assert.doesNotMatch(actionsSource, /export async function updateHouseImagesAction/);
    assert.match(actionsSource, /getHouseImageById/);
    assert.match(actionsSource, /getHouseImagesByIds/);
    assert.match(actionsSource, /getImageFiles/);
    assert.match(actionsSource, /validateHouseImageFile/);
    assert.match(actionsSource, /validateHouseImageZone/);
    assert.match(actionsSource, /buildHouseImageName/);
    assert.match(actionsSource, /buildHouseImageUrl/);
    assert.match(actionsSource, /uploadHouseImageObject/);
    assert.match(actionsSource, /deleteHouseImageObject/);
    assert.match(actionsSource, /deleteAwsHouseImageObject/);
    assert.match(actionsSource, /getAwsS3ImageEnv/);
    assert.match(actionsSource, /\.\.\.awsImageEnv/);
    assert.match(actionsSource, /imageUrl/);
    assert.match(actionsSource, /getHouseImageStorageProvider/);
    assert.match(actionsSource, /uploadedObjectKeys/);
    assert.match(actionsSource, /cleanupUploadedImages/);
    assert.match(actionsSource, /cleanupWarning/);
    assert.match(actionsSource, /storageFailed/);
    assert.match(actionsSource, /isHouseImageFileOperationAllowed\(image\.image_url, "delete"\)/);
    assert.match(
      actionsSource,
      /const deleteStorageFirst = getHouseImageStorageProvider\(image\.image_url\) === "aws-s3";[\s\S]*if \(deleteStorageFirst\) {[\s\S]*await deleteStoredHouseImage[\s\S]*await deleteHouseImageById\(supabase, image\.id\);[\s\S]*if \(!deleteStorageFirst\) {/,
    );
    assert.equal(
      actionsSource.match(/const deleteStorageFirst = getHouseImageStorageProvider\(image\.image_url\) === "aws-s3";/g)
        ?.length,
      2,
    );
    assert.match(actionsSource, /canUseAccommodation\(adminUser\)/);
    assert.match(actionsSource, /Admin profile is incomplete/);
    assert.match(actionsSource, /create_by: adminCreateBy/);
    assert.doesNotMatch(actionsSource, /ADMIN_ROLE_ID/);
    assert.doesNotMatch(actionsSource, /LEGACY_SYSTEM_IMAGE_CREATE_BY/);
    assert.doesNotMatch(actionsSource, /redirect\(/);
    assert.doesNotMatch(actionsSource, /deleted_image_ids/);
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
