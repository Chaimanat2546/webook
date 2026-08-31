import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const actionsUrl = new URL("../app/admin/houses/[propertyId]/actions.ts", import.meta.url);
const repositoryUrl = new URL("../server/repositories/listings.ts", import.meta.url);

describe("house detail actions", () => {
  function actionSource(actionsSource: string, actionName: string): string {
    const start = actionsSource.indexOf(`export async function ${actionName}`);
    const nextAction = actionsSource.indexOf("export async function ", start + 1);
    return actionsSource.slice(start, nextAction === -1 ? undefined : nextAction);
  }

  it("updates listing details through an authenticated accommodation server action", () => {
    assert.equal(existsSync(actionsUrl), true);

    const actionsSource = readFileSync(actionsUrl, "utf8");
    const repositorySource = readFileSync(repositoryUrl, "utf8");

    assert.match(actionsSource, /"use server"/);
    assert.match(actionsSource, /export async function saveHouseDetailsAction/);
    assert.match(actionsSource, /requireAdmin\(\)/);
    assert.match(actionsSource, /canUseAccommodation\(adminUser\)/);
    assert.match(actionsSource, /canManageHouseRating\(adminUser\)/);
    assert.match(actionsSource, /getListingByPropertyId\(supabase, propertyId\)/);
    assert.match(actionsSource, /normalizeListingDetailsFormValues/);
    assert.match(actionsSource, /owner_id: house\.owner_id/);
    assert.match(actionsSource, /rating: canManageRating \? normalizedValues\.rating : house\.rating/);
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

  it("updates weekly listing prices through an authenticated price-only server action", () => {
    const actionsSource = readFileSync(actionsUrl, "utf8");
    const repositorySource = readFileSync(repositoryUrl, "utf8");

    assert.match(actionsSource, /export async function saveHousePricesAction/);
    assert.match(actionsSource, /requireAdmin\(\)/);
    const priceActionSource = actionSource(actionsSource, "saveHousePricesAction");

    assert.match(priceActionSource, /assertCanManageHousePrices\(canManageHousePrices\(adminUser\)\)/);
    assert.doesNotMatch(priceActionSource, /assertCanUseAccommodation\(canUseAccommodation\(adminUser\)\)/);
    assert.match(actionsSource, /getListingByPropertyId\(supabase, propertyId\)/);
    assert.match(actionsSource, /normalizeListingPriceFormValues/);
    assert.match(actionsSource, /updateListingPricesByListingId\(supabase, house\.id, values\)/);
    assert.match(actionsSource, /new URLSearchParams\(\{ saved: "1", section: "prices" \}\)/);

    assert.match(repositorySource, /export async function getListingPricesByListingId/);
    assert.match(repositorySource, /export async function updateListingPricesByListingId/);
    assert.match(repositorySource, /\.from\("listing_prices"\)[\s\S]*\.select\("day_of_week"\)/);
    assert.match(repositorySource, /\.from\("listing_prices"\)[\s\S]*\.update\(/);
    assert.match(repositorySource, /\.eq\("listing_id", listingId\)/);
    assert.match(repositorySource, /\.eq\("day_of_week", value\.day_of_week\)/);
    assert.match(repositorySource, /\.from\("listing_prices"\)[\s\S]*\.insert\(/);
    assert.doesNotMatch(repositorySource, /base_guests: value/);
    assert.doesNotMatch(repositorySource, /notes: value/);
  });

  it("updates listing facilities without managing the facilities master", () => {
    const actionsSource = readFileSync(actionsUrl, "utf8");
    const repositorySource = readFileSync(repositoryUrl, "utf8");
    const facilitiesActionSource = actionSource(actionsSource, "saveHouseFacilitiesAction");

    assert.match(actionsSource, /export async function saveHouseFacilitiesAction/);
    assert.match(actionsSource, /requireAdmin\(\)/);
    assert.match(facilitiesActionSource, /assertCanUseAccommodation\(canUseAccommodation\(adminUser\)\)/);
    assert.match(actionsSource, /getListingByPropertyId\(supabase, propertyId\)/);
    assert.match(actionsSource, /getFacilities\(supabase\)/);
    assert.match(actionsSource, /normalizeListingFacilityFormValues\(formData, facilities\)/);
    assert.match(actionsSource, /updateListingFacilitiesByListingId\(supabase, house\.id, values\)/);
    assert.match(actionsSource, /new URLSearchParams\(\{ saved: "1", section: "facilities" \}\)/);

    assert.match(repositorySource, /export async function getFacilities/);
    assert.match(repositorySource, /\.from\("facilities"\)[\s\S]*\.select\("id,name,title"\)/);
    assert.match(repositorySource, /export async function getListingFacilitiesByListingId/);
    assert.match(repositorySource, /\.from\("listing_facilities"\)[\s\S]*\.select\("id,listing_id,facility_id,message,value_boolean"\)/);
    assert.match(repositorySource, /export async function updateListingFacilitiesByListingId/);
    assert.match(repositorySource, /\.from\("listing_facilities"\)[\s\S]*\.select\("facility_id"\)/);
    assert.match(repositorySource, /\.update\(\{ \.\.\.value, updated_at: timestamp \}\)/);
    assert.match(repositorySource, /\.eq\("facility_id", value\.facility_id\)/);
    assert.match(repositorySource, /\.from\("listing_facilities"\)\.insert\(inserts\)/);
    assert.doesNotMatch(repositorySource, /\.from\("facilities"\)\s*\.\s*(insert|update|delete)\(/);
    assert.doesNotMatch(repositorySource, /\.from\("listing_facilities"\)[\s\S]{0,160}\.delete\(/);
  });

  it("keeps accommodation permission on details updates", () => {
    const actionsSource = readFileSync(actionsUrl, "utf8");
    const detailsActionSource = actionSource(actionsSource, "saveHouseDetailsAction");

    assert.match(detailsActionSource, /assertCanUseAccommodation\(canUseAccommodation\(adminUser\)\)/);
  });
});
