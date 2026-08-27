import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageUrl = new URL("../app/admin/users/page.tsx", import.meta.url);
const actionsUrl = new URL("../app/admin/users/actions.ts", import.meta.url);

describe("Webook user management route and actions", () => {
  it("guards the users route before loading the list", () => {
    assert.ok(existsSync(pageUrl));
    const page = readFileSync(pageUrl, "utf8");

    assert.match(page, /await requireWebookUserManagerAdmin\(\)/);
    assert.match(page, /listWebookUsers\(supabase\)/);
  });

  it("checks Role 1 and revalidates only the Webook users route in every mutation", () => {
    assert.ok(existsSync(actionsUrl));
    const actions = readFileSync(actionsUrl, "utf8");

    assert.match(actions, /requireWebookUserManagerAdmin\(\)/);
    assert.match(actions, /revalidatePath\("\/admin\/users"\)/);
    assert.doesNotMatch(actions, /createSupabaseAdminClient/);
  });
});
