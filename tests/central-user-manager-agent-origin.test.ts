import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CentralUserManagerAgentOriginError,
  normalizeAgentOrigin,
  readStoredAgentOrigin,
} from "../server/central-user-manager/agent-origin.ts";

describe("Central User Manager Agent origin", () => {
  it("normalizes an exact public HTTPS origin and default port", () => {
    assert.equal(
      normalizeAgentOrigin("https://Tenant.Example.COM:443/"),
      "https://tenant.example.com",
    );
    assert.equal(
      readStoredAgentOrigin("https://tenant.example.com"),
      "https://tenant.example.com",
    );
  });

  it("requires stored origins to already be canonical", () => {
    assert.throws(
      () => readStoredAgentOrigin("https://Tenant.Example.COM:443/"),
      CentralUserManagerAgentOriginError,
    );
  });

  it("rejects transport, authority, and destination mutations", () => {
    for (const value of [
      "http://tenant.example.com",
      "https://user@tenant.example.com",
      "https://user:pass@tenant.example.com",
      "https://tenant.example.com:8443",
      "https://tenant.example.com/path",
      "https://tenant.example.com/.",
      "https://tenant.example.com/path/..",
      "https://tenant.example.com?next=1",
      "https://tenant.example.com#fragment",
      " https://tenant.example.com",
      "https://tenant.example.com\\@attacker.example",
      "https://tenant.example.com/%2e",
    ]) {
      assert.throws(
        () => normalizeAgentOrigin(value),
        CentralUserManagerAgentOriginError,
        value,
      );
    }
  });

  it("rejects localhost, IP literals, private names, and confusable hosts", () => {
    for (const value of [
      "https://localhost",
      "https://app.localhost",
      "https://127.0.0.1",
      "https://127.1",
      "https://2130706433",
      "https://[::1]",
      "https://127.0.0.1.nip.io",
      "https://169.254.169.254.nip.io",
      "https://127.0.0.1.sslip.io",
      "https://tenant.local",
      "https://tenant.internal",
      "https://tenant.home",
      "https://tenant.lan",
      "https://tenant.test",
      "https://tenant.invalid",
      "https://tenant.example",
      "https://xn--80ak6aa92e.example.com",
      "https://аpp.example.com",
      "https://tenant..example.com",
      "https://-tenant.example.com",
      "https://tenant-.example.com",
    ]) {
      assert.throws(
        () => normalizeAgentOrigin(value),
        CentralUserManagerAgentOriginError,
        value,
      );
    }
  });

  it("requires the production fetch runtime to reject private DNS resolution and rebinding", () => {
    const wrangler = readFileSync(
      new URL("../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    assert.match(wrangler, /"global_fetch_strictly_public"/);
  });
});
