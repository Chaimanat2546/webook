import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { ReactElement, ReactNode } from "react";
import { parseBookingGalleryQuery, type BookingGalleryCard } from "../lib/booking-gallery.ts";

test("month changes reject unsupported input without changing the current query", async () => {
  const { tryBookingGalleryQuery } = await import("../lib/booking-gallery-month.ts");
  const current = parseBookingGalleryQuery({ month: "2026-09", zone: "พัทยา", order: "title" });
  const invalid = tryBookingGalleryQuery(current, { month: "0001-01" });
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /เดือน/);
  assert.equal(current.month, "2026-09");
  const next = tryBookingGalleryQuery(current, { month: "2026-10" });
  assert.equal(next.ok, true);
  if (next.ok) assert.deepEqual({ month: next.query.month, zone: next.query.zone, order: next.query.order }, { month: "2026-10", zone: "พัทยา", order: "title" });
});

test("month arrows stop before invalid calendar bounds", async () => {
  const { adjacentBookingGalleryMonth } = await import("../lib/booking-gallery-month.ts");
  assert.equal(adjacentBookingGalleryMonth("1000-01", -1), null);
  assert.equal(adjacentBookingGalleryMonth("9999-11", 1), null);
  assert.equal(adjacentBookingGalleryMonth("2026-09", -1), "2026-08");
  assert.equal(adjacentBookingGalleryMonth("2026-09", 1), "2026-10");
});

interface ElementProps { children?: ReactNode; "aria-label"?: string; onClick?: (event: { currentTarget: HTMLElement }) => void; }
function buttonsIn(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(buttonsIn);
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) return [];
  const element = node as ReactElement<ElementProps>;
  return [ ...(element.type === "button" ? [element] : []), ...buttonsIn(element.props.children) ];
}

test("expanded calendar forwards occupied and free-day selections with the persistent trigger, then closes", async () => {
  const entry = fileURLToPath(new URL("../components/admin/bookings/booking-gallery-days.tsx", import.meta.url));
  const output = await build({ entryPoints: [entry], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Days = loaded.exports.BookingGalleryDays as (props: Record<string, unknown>) => ReactElement<ElementProps>;
  const card: BookingGalleryCard = {
    propertyId: "house-101", title: "บ้านริมทะเล", zone: "พัทยา", bookedNights: 1,
    days: {
      "2026-09-20": { date: "2026-09-20", tone: "confirmed", bookingId: "booking-7" },
      "2026-09-21": { date: "2026-09-21", tone: "free", bookingId: null },
    },
  };
  const expandButton = {} as HTMLElement;
  const dateButton = {} as HTMLElement;
  const selected: unknown[][] = [];
  let closed = 0;
  const element = Days({ card, month: "2026-09", today: "2026-09-01", expanded: true,
    getTrigger: () => expandButton,
    onSelected: () => { closed++; },
    onBookingSelect: (...values: unknown[]) => selected.push(["edit", ...values]),
    onCreateSelect: (...values: unknown[]) => selected.push(["create", ...values]),
  });
  const buttons = buttonsIn(element);
  assert.equal(buttons.length, 2);
  buttons.find(button => button.props["aria-label"]?.includes("2026-09-20"))?.props.onClick?.({ currentTarget: dateButton });
  buttons.find(button => button.props["aria-label"]?.includes("2026-09-21"))?.props.onClick?.({ currentTarget: dateButton });
  assert.deepEqual(selected, [
    ["edit", "house-101", "booking-7", expandButton],
    ["create", "house-101", "2026-09-21", expandButton],
  ]);
  assert.equal(closed, 2);
});
