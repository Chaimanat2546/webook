import { test } from "node:test";
import assert from "node:assert/strict";
import { assertBookingNotPast, bookingToday, bookingConflict, occupiedNight } from "../lib/booking-availability.ts";
const rows = [{ id: "1", check_in: "2026-09-23", check_out: "2026-09-25", status: "waiting" }];
test("blocks occupied nights and crossing ranges, permits adjacent checkout/checkin", () => {
 assert.ok(occupiedNight(rows, "2026-09-23"));
 assert.ok(bookingConflict(rows, "2026-09-20", "2026-09-26"));
 assert.equal(bookingConflict(rows, "2026-09-20", "2026-09-23"), undefined);
 assert.equal(occupiedNight(rows, "2026-09-25"), undefined);
 assert.equal(bookingConflict(rows, "2026-09-25", "2026-09-27"), undefined);
});
test("ignores cancelled and edited booking, blocks other noncancelled statuses", () => {
 assert.equal(bookingConflict(rows, "2026-09-23", "2026-09-25", "1"), undefined);
 assert.equal(occupiedNight([{...rows[0], status:"cancelled"}], "2026-09-23"), undefined);
 assert.ok(occupiedNight([{...rows[0], status:"confirmed"}], "2026-09-23"));
});

test("Bangkok midnight determines booking cutoff; today is allowed", () => {
 assert.equal(bookingToday(new Date("2026-09-20T16:59:59Z")), "2026-09-20");
 assert.equal(bookingToday(new Date("2026-09-20T17:00:00Z")), "2026-09-21");
 assert.throws(() => assertBookingNotPast("2026-09-20", "2026-09-22", "2026-09-21"), /ผ่านมา/);
 assert.doesNotThrow(() => assertBookingNotPast("2026-09-21", "2026-09-22", "2026-09-21"));
});
test("existing historical stay may be maintained but not rescheduled or reactivated in the past", () => {
 const old = { check_in: "2026-09-10", check_out: "2026-09-12", status: "confirmed" };
 assert.doesNotThrow(() => assertBookingNotPast(old.check_in, old.check_out, "2026-09-21", old));
 assert.throws(() => assertBookingNotPast("2026-09-11", old.check_out, "2026-09-21", old));
 assert.throws(() => assertBookingNotPast(old.check_in, old.check_out, "2026-09-21", { ...old, status: "cancelled" }));
});

test("repair blocks its nights and releases on checkout or cancellation", () => {
 const repair = [{ id: "repair", status: "repair", check_in: "2026-09-21", check_out: "2026-09-24" }];
 assert.ok(bookingConflict(repair, "2026-09-22", "2026-09-25"));
 assert.equal(bookingConflict(repair, "2026-09-24", "2026-09-25"), undefined);
 assert.equal(bookingConflict([{ ...repair[0], status: "cancelled" }], "2026-09-22", "2026-09-25"), undefined);
});
