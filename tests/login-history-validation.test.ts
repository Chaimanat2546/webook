import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLocationReport, parseHistoryFilter, classifyLoginDevice, actorFromClaims } from "../lib/login-history.ts";
const historyId = "40000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000001";
test("location accepts zero coordinates and rejects malformed numeric payloads", () => {
  const valid = { historyId, status: "success", latitude: 0, longitude: 0, accuracy: 0, capturedAt: "2026-10-26T10:00:00Z" };
  assert.equal(parseLocationReport(valid).status, "success");
  for (const patch of [{ latitude: 91 }, { longitude: -181 }, { accuracy: -1 }, { accuracy: Infinity }, { latitude: NaN }, { latitude: "0" }, { longitude: null }, { capturedAt: "yesterday" }, { historyId: "bad" }, { userId: actorId }]) {
    assert.throws(() => parseLocationReport({ ...valid, ...patch }));
  }
  for (const status of ["skipped", "denied", "unavailable", "timeout", "unsupported"]) {
    assert.equal(parseLocationReport({ historyId, status }).status, status);
    assert.throws(() => parseLocationReport({ historyId, status, latitude: 0 }));
  }
  assert.throws(() => parseLocationReport({ historyId, status: "pending" }));
});
test("history dates use inclusive Bangkok days and reject filters instead of broadening them", () => {
  const filter = parseHistoryFilter({ from: "2026-10-26", to: "2026-10-26" });
  assert.equal(filter.from, "2026-10-25T17:00:00.000Z");
  assert.equal(filter.to, "2026-10-26T17:00:00.000Z");
  assert.equal(filter.pageSize, 25);
  for (const invalid of [{ from: "2026-02-30" }, { from: "2026-10-27", to: "2026-10-26" }, { page: "0" }, { page: "1oops" }, { pageSize: "101" }, { q: "a".repeat(201) }]) {
    assert.throws(() => parseHistoryFilter(invalid));
  }
});
test("claims must match the verified auth identity and carry UUID session", () => {
  const claims = { sub: actorId, session_id: historyId };
  assert.deepEqual(actorFromClaims(claims, actorId), { userId: actorId, sessionId: historyId });
  assert.throws(() => actorFromClaims(claims, historyId));
  assert.throws(() => actorFromClaims({ ...claims, session_id: "bad" }, actorId));
});
test("device classification is bounded and supports unknown and common browsers", () => {
  assert.deepEqual(classifyLoginDevice(null), { os: "unknown", browser: "unknown", deviceType: "unknown" });
  assert.deepEqual(classifyLoginDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), { os: "iOS", browser: "Safari", deviceType: "mobile" });
  assert.equal(classifyLoginDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0").browser, "Edge");
  assert.equal(classifyLoginDevice("x".repeat(100000)).deviceType, "unknown");
});
