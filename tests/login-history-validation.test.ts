import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLocationReport, parseHistoryFilter, classifyLoginDevice, actorFromClaims, LoginHistoryError } from "../lib/login-history.ts";
const historyId = "40000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000001";

test("history accepts dashboard hourly windows and rejects invalid or incomplete clocks", () => {
  const dates = { from:"2026-10-28", to:"2026-10-29" };
  const filter = parseHistoryFilter({ ...dates, timeFrom:"09:00", timeTo:"18:00" });
  assert.equal(filter.timeFrom,"09:00");
  assert.equal(filter.timeTo,"18:00");
  assert.equal(filter.from,"2026-10-27T17:00:00.000Z");
  assert.equal(filter.to,"2026-10-29T17:00:00.000Z");
  assert.equal(parseHistoryFilter({ ...dates,timeFrom:"23:00",timeTo:"24:00" }).timeTo,"24:00");
  for (const clocks of [
    {timeFrom:"09:00"}, {timeTo:"18:00"}, {timeFrom:"09:30",timeTo:"18:00"},
    {timeFrom:"24:00",timeTo:"24:00"}, {timeFrom:"18:00",timeTo:"09:00"},
    {timeFrom:"09:00",timeTo:"09:00"}, {timeFrom:"",timeTo:""},
  ]) assert.throws(() => parseHistoryFilter({...dates,...clocks}), error => error instanceof LoginHistoryError && error.reason === "invalid_date");
  assert.throws(() => parseHistoryFilter({timeFrom:"09:00",timeTo:"18:00"}));
  assert.throws(() => parseHistoryFilter({from:dates.from,timeFrom:"09:00",timeTo:"18:00"}));
});

test("history status and order are allowlisted and date failures stay distinguishable", () => {
  assert.equal(parseHistoryFilter({}).status, null);
  assert.equal(parseHistoryFilter({}).sort, "latest");
  for (const status of ["pending", "success", "skipped", "denied", "unavailable", "timeout", "unsupported"]) {
    assert.equal(parseHistoryFilter({status, sort:"oldest"}).status, status);
    assert.equal(parseHistoryFilter({status, sort:"oldest"}).sort, "oldest");
  }
  for (const query of [{status:"invented"}, {sort:"asc"}, {sort:"logged_in_at;drop table"}]) assert.throws(() => parseHistoryFilter(query));
  for (const query of [{from:"2026-02-30"}, {from:"2026-10-28",to:"2026-10-27"}]) {
    assert.throws(() => parseHistoryFilter(query), error => error instanceof LoginHistoryError && error.reason === "invalid_date");
  }
});
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
