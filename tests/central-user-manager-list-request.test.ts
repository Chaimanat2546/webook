import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCentralUserListFormData } from "../components/admin/user-manager/user-list-request.ts";

describe("central user manager list request", () => {
  it("builds a ten-user request for the selected Tenant and requested page", () => {
    const formData = createCentralUserListFormData({
      tenantKey: "baan-pool-villa-staging",
      page: 2,
      operationId: "123e4567-e89b-42d3-a456-426614174000",
    });

    assert.deepEqual(Object.fromEntries(formData), {
      tenantKey: "baan-pool-villa-staging",
      page: "2",
      pageSize: "10",
      operationId: "123e4567-e89b-42d3-a456-426614174000",
    });
  });
});
