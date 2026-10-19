import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1"
  || process.env.RUN_QUOTATION_DB_TESTS === "1";
const url = process.env.LOCAL_SUPABASE_URL ?? "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "Quotation-customer-local-test-2026!";

describe("quotation customer local database integration", { skip: !enabled }, () => {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const service = createClient(url || "http://127.0.0.1:54321", serviceRoleKey || "local-test-skipped", options);
  const allowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", options);
  const otherAllowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", options);
  const denied = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", options);
  const anonymous = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", options);
  const userIds: string[] = [];
  const customerIds: string[] = [];
  let ownerId = "";
  let otherOwnerId = "";

  before(async () => {
    assert.ok(url && anonKey && serviceRoleKey, "local Supabase environment is required");
    const users = await Promise.all([
      { client: allowed, permission: true, prefix: "allowed" },
      { client: otherAllowed, permission: true, prefix: "other" },
      { client: denied, permission: false, prefix: "denied" },
    ].map(async ({ client, permission, prefix }) => {
      const email = `quotation-customer-${prefix}-${crypto.randomUUID()}@example.test`;
      const created = await service.auth.admin.createUser({ email, email_confirm: true, password });
      assert.equal(created.error, null, created.error?.message);
      const id = created.data.user!.id;
      userIds.push(id);
      return { client, email, id, permission };
    }));
    ownerId = users[0]!.id;
    otherOwnerId = users[1]!.id;

    const inserted = await service.from("users").insert(users.map(({ email, id, permission }) => ({
      allow_tools: permission ? { allow_quotation: true } : {},
      email,
      uid: id,
    })));
    assert.equal(inserted.error, null, inserted.error?.message);
    for (const user of users) {
      const signedIn = await user.client.auth.signInWithPassword({ email: user.email, password });
      assert.equal(signedIn.error, null, signedIn.error?.message);
    }
  });

  it("isolates owner reads and uniqueness while reserving mutations for the server boundary", async () => {
    const directInsert = await allowed.from("quotation_customers").insert({
      address: "Shared address",
      customer_type: "juristic",
      name: "Shared customer",
      office_type: "head_office",
      owner_id: ownerId,
      tax_id: "0107544000108",
    }).select("id").single();
    assert.equal(directInsert.error?.code, "42501");

    const inserted = await service.from("quotation_customers").insert({
      address: "Shared address",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Shared customer",
      office_type: "head_office",
      tax_id: "0107544000108",
      updated_by: ownerId,
    }).select("id").single();
    assert.equal(inserted.error, null, inserted.error?.message);
    const customerId = inserted.data.id;
    customerIds.push(customerId);

    const firstBranch = await service.from("quotation_customers").insert({
      address: "Branch 00001 address",
      branch_number: "00001",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Shared customer branch 00001",
      office_type: "branch",
      tax_id: "0107544000108",
      updated_by: ownerId,
    }).select("id").single();
    assert.equal(firstBranch.error, null, firstBranch.error?.message);
    customerIds.push(firstBranch.data.id);

    const secondBranch = await service.from("quotation_customers").insert({
      address: "Branch 00002 address",
      branch_number: "00002",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Shared customer branch 00002",
      office_type: "branch",
      tax_id: "0107544000108",
      updated_by: ownerId,
    }).select("id").single();
    assert.equal(secondBranch.error, null, secondBranch.error?.message);
    customerIds.push(secondBranch.data.id);

    const duplicateMain = await service.from("quotation_customers").insert({
      address: "Duplicate main address",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Duplicate main customer",
      office_type: "unspecified",
      tax_id: "0107544000108",
      updated_by: ownerId,
    });
    assert.equal(duplicateMain.error?.code, "23505");

    const duplicateActiveBranch = await service.from("quotation_customers").insert({
      address: "Duplicate branch address",
      branch_number: "00001",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Duplicate active branch",
      office_type: "branch",
      tax_id: "0107544000108",
      updated_by: ownerId,
    });
    assert.equal(duplicateActiveBranch.error?.code, "23505");

    const deactivatedBranch = await service.from("quotation_customers")
      .update({ is_active: false, updated_by: ownerId }).eq("id", firstBranch.data.id);
    assert.equal(deactivatedBranch.error, null, deactivatedBranch.error?.message);

    const duplicateInactiveBranch = await service.from("quotation_customers").insert({
      address: "Duplicate inactive branch address",
      branch_number: "00001",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Duplicate inactive branch",
      office_type: "branch",
      tax_id: "0107544000108",
      updated_by: ownerId,
    });
    assert.equal(duplicateInactiveBranch.error?.code, "23505");

    const reactivatedBranch = await service.from("quotation_customers")
      .update({ is_active: true, updated_by: ownerId }).eq("id", firstBranch.data.id);
    assert.equal(reactivatedBranch.error, null, reactivatedBranch.error?.message);

    const nonCanonicalBranch = await service.from("quotation_customers").insert({
      address: "Padded branch address",
      branch_number: " 00003 ",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Padded branch",
      office_type: "branch",
      tax_id: "0107544000108",
      updated_by: ownerId,
    });
    assert.equal(nonCanonicalBranch.error?.code, "23514");

    const individual = await service.from("quotation_customers").insert({
      address: "Individual address",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "individual",
      name: "Individual customer",
      office_type: "unspecified",
      tax_id: "1101700203451",
      updated_by: ownerId,
    }).select("id").single();
    assert.equal(individual.error, null, individual.error?.message);
    customerIds.push(individual.data.id);

    const deactivateIndividual = await service.from("quotation_customers")
      .update({ is_active: false, updated_by: ownerId }).eq("id", individual.data.id);
    assert.equal(deactivateIndividual.error, null, deactivateIndividual.error?.message);

    const duplicateIndividual = await service.from("quotation_customers").insert({
      address: "Duplicate individual address",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "individual",
      name: "Duplicate individual customer",
      office_type: "unspecified",
      tax_id: "1101700203451",
      updated_by: ownerId,
    });
    assert.equal(duplicateIndividual.error?.code, "23505");

    const ownerRead = await allowed.from("quotation_customers")
      .select("id,owner_id").eq("id", customerId).single();
    assert.equal(ownerRead.error, null, ownerRead.error?.message);
    assert.deepEqual(ownerRead.data, { id: customerId, owner_id: ownerId });

    const foreignRead = await otherAllowed.from("quotation_customers")
      .select("id").eq("id", customerId);
    assert.equal(foreignRead.error, null, foreignRead.error?.message);
    assert.deepEqual(foreignRead.data, []);

    const otherCustomer = await service.from("quotation_customers").insert({
      address: "Other owner address",
      created_by: otherOwnerId,
      customer_type: "juristic",
      name: "Other owner customer",
      office_type: "head_office",
      owner_id: otherOwnerId,
      tax_id: "0107544000108",
      updated_by: otherOwnerId,
    }).select("id").single();
    assert.equal(otherCustomer.error, null, otherCustomer.error?.message);
    customerIds.push(otherCustomer.data.id);
    const hiddenFromOwner = await allowed.from("quotation_customers")
      .select("id").eq("id", otherCustomer.data.id);
    assert.equal(hiddenFromOwner.error, null, hiddenFromOwner.error?.message);
    assert.deepEqual(hiddenFromOwner.data, []);

    for (const [client, expected] of [[allowed, [customerId, firstBranch.data.id, secondBranch.data.id]], [otherAllowed, [otherCustomer.data.id]]] as const) {
      const listed = await client.rpc("list_quotation_customers", { p_search: "0107544000108" });
      assert.equal(listed.error, null, listed.error?.message);
      assert.deepEqual(listed.data.map((row: { id: string }) => row.id).sort(), [...expected].sort());
    }

    const anonymousRead = await anonymous.from("quotation_customers").select("id");
    assert.equal(anonymousRead.error?.code, "42501");

    const deniedRead = await denied.from("quotation_customers").select("id");
    assert.equal(deniedRead.error, null, deniedRead.error?.message);
    assert.deepEqual(deniedRead.data, []);

    const directUpdate = await allowed.from("quotation_customers")
      .update({ name: "Forged" }).eq("id", customerId);
    assert.equal(directUpdate.error?.code, "42501");

    const foreignUpdate = await otherAllowed.from("quotation_customers")
      .update({ name: "Forged foreign customer", owner_id: otherOwnerId }).eq("id", customerId);
    assert.equal(foreignUpdate.error?.code, "42501");
    const unchanged = await service.from("quotation_customers")
      .select("owner_id,name").eq("id", customerId).single();
    assert.equal(unchanged.error, null, unchanged.error?.message);
    assert.deepEqual(unchanged.data, { owner_id: ownerId, name: "Shared customer" });

    const deactivated = await service.from("quotation_customers")
      .update({ is_active: false, updated_by: ownerId }).eq("id", customerId);
    assert.equal(deactivated.error, null, deactivated.error?.message);

    const duplicateInactive = await service.from("quotation_customers").insert({
      address: "Duplicate address",
      created_by: ownerId,
      owner_id: ownerId,
      customer_type: "juristic",
      name: "Duplicate customer",
      office_type: "head_office",
      tax_id: "0107544000108",
      updated_by: ownerId,
    });
    assert.equal(duplicateInactive.error?.code, "23505");

    const reactivated = await service.from("quotation_customers")
      .update({ is_active: true, updated_by: ownerId }).eq("id", customerId);
    assert.equal(reactivated.error, null, reactivated.error?.message);

    const hardDelete = await allowed.from("quotation_customers").delete().eq("id", customerId);
    assert.equal(hardDelete.error?.code, "42501");
  });

  after(async () => {
    if (customerIds.length) await service.from("quotation_customers").delete().in("id", customerIds);
    if (userIds.length) await service.from("users").delete().in("uid", userIds);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });
});
