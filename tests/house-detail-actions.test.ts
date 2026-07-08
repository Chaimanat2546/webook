import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const actionsUrl = new URL("../app/admin/houses/[propertyId]/actions.ts", import.meta.url);
const repositoryUrl = new URL("../server/repositories/listings.ts", import.meta.url);

describe("house detail actions", () => {
  it("updates listing details through an authenticated accommodation server action", () => {
    assert.equal(existsSync(actionsUrl), true);

    const actionsSource = readFileSync(actionsUrl, "utf8");
    const repositorySource = readFileSync(repositoryUrl, "utf8");

    assert.match(actionsSource, /"use server"/);
    assert.match(actionsSource, /export async function saveHouseDetailsAction/);
    assert.match(actionsSource, /requireAdmin\(\)/);
    assert.match(actionsSource, /canUseAccommodation\(adminUser\)/);
    assert.match(actionsSource, /getListingByPropertyId\(supabase, propertyId\)/);
    assert.match(actionsSource, /normalizeListingDetailsFormValues/);
    assert.match(actionsSource, /owner_id: house\.owner_id/);
    assert.match(actionsSource, /rating: house\.rating/);
    assert.match(actionsSource, /updateListingDetailsByPropertyId\(supabase, propertyId, values\)/);
    assert.match(actionsSource, /revalidatePath\("\/admin\/houses"\)/);
    assert.match(actionsSource, /redirect\(`/);

    assert.match(repositorySource, /export async function updateListingDetailsByPropertyId/);
    assert.match(repositorySource, /\.from\("listings"\)[\s\S]*\.update\([\s\S]*\.eq\("property_id", propertyId\)/);
    assert.match(repositorySource, /listingDetailSelect/);
    assert.match(repositorySource, /owner_id/);
    assert.match(repositorySource, /notes/);
    assert.match(repositorySource, /property_type/);
    assert.doesNotMatch(repositorySource, /description,/);
    assert.doesNotMatch(repositorySource, /property_tags,/);
    assert.doesNotMatch(repositorySource, /sort_order,/);
  });
});
