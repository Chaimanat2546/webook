import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import type { NotificationsContextValue } from "../components/admin/notifications/notifications-context.tsx";

async function render(entry: string, exported: string, overrides: Partial<NotificationsContextValue> = {}) {
  const state: NotificationsContextValue = { data: null, observedAt: null, actorId: "actor", loading: false, error: null, open: true, setOpen() {}, loadingMore: false, loadMoreError: null, loadMore: async () => {}, acceptNew: async () => true, filter: "all", setFilter() {}, refresh: async () => {}, markRead: async () => true, cleanupDevice: async () => true, ...overrides };
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "browser-boundaries", setup(builder) {
    builder.onResolve({ filter: /notifications-context$/ }, () => ({ path: "context-fixture", external: true }));
    builder.onResolve({ filter: /ui\/sidebar$/ }, () => ({ path: "sidebar-fixture", external: true }));
    builder.onResolve({ filter: /ui\/sheet$/ }, () => ({ path: "sheet-fixture", external: true }));
    builder.onResolve({ filter: /push-settings$/ }, () => ({ path: "push-fixture", external: true }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation-fixture", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  const wrapper = ({ children, ...props }: { children: ReactNode }) => createElement("div", props, children);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => {
    if (id === "context-fixture") return { useNotifications: () => state };
    if (id === "navigation-fixture") return { useRouter: () => ({ push() {}, back() {} }), usePathname: () => "/admin/bookings" };
    if (id === "sidebar-fixture") return { SidebarMenuItem: wrapper, SidebarMenuButton: wrapper };
    if (id === "push-fixture") return { PushSettings: () => null };
    if (id === "sheet-fixture") return { Sheet: ({ children }: { children: ReactNode }) => createElement("div", null, children), SheetContent: wrapper, SheetHeader: wrapper, SheetTitle: wrapper, SheetDescription: wrapper };
    return require(id);
  }, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports[exported] as ComponentType));
}

const inbox = { actorId: "actor", items: [], unreadCount: 123, total: 41, page: 1, pageSize: 20, asOf: "2026-10-22T12:00:00Z", pushPublicKey: null, nextCursor: { createdAt: "2026-10-22T12:00:00Z", id: "00000000-0000-4000-8000-000000000001" }, hasNew: false, retained: null, retainedCursor: null };

test("bell announces the unread count, expansion state and caps only the visible badge", async () => {
  const html = await render("components/admin/notifications/notification-bell.tsx", "NotificationBell", { data: inbox });
  assert.match(html, /aria-label="การแจ้งเตือน ยังไม่อ่าน 123 รายการ"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /99\+/);
  assert.match(html, /print:hidden/);
});

test("initial inbox failures keep unknown count and offer retry instead of an empty inbox", async () => {
  const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { error: "โหลดการแจ้งเตือนไม่สำเร็จ" });
  assert.match(html, /ยังไม่ทราบจำนวนที่ยังไม่อ่าน/);
  assert.match(html, /ลองอีกครั้ง/);
  assert.doesNotMatch(html, /ยังไม่มีการแจ้งเตือน|ยังไม่อ่าน 0 รายการ/);
});

test("inbox supports loading, empty and cursor loading states", async () => {
  const loading = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { loading: true });
  assert.match(loading, /aria-label="กำลังโหลดการแจ้งเตือน"/);
  const empty = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, total: 0, unreadCount: 0 } });
  assert.match(empty, /ยังไม่มีการแจ้งเตือน/);
  const paginated = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: inbox });
  assert.match(paginated, /โหลดเพิ่มเติม/);
  assert.doesNotMatch(paginated, /หน้าถัดไป|หน้าก่อนหน้า/);
});

test("new-item and failed append controls preserve the existing inbox", async () => {
  const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, hasNew: true }, loadMoreError: "โหลดรายการเพิ่มเติมไม่สำเร็จ" });
  assert.match(html, /มีแจ้งเตือนใหม่/);
  assert.match(html, /โหลดรายการเพิ่มเติมไม่สำเร็จ/);
  assert.match(html, /ลองโหลดเพิ่มเติมอีกครั้ง/);
});

test("inbox exposes supported filters, refresh and real detail actions", async () => {
  const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, unreadCount: 0, total: 0 } });
  assert.match(html, /การจองใหม่/);
  assert.match(html, /การชำระเงิน/);
  assert.match(html, /รีเฟรชข้อมูล/);
  assert.doesNotMatch(html, /SMS|LINE|ตรวจสอบสลิป|ส่งข้อความแจ้งเตือนซ้ำ/);
});

test("filtered-empty is distinct from an empty inbox and the mobile page owns one header", async () => {
  const html = await render("components/admin/notifications/notifications-page.tsx", "NotificationsPage", { filter: "payment", data: { ...inbox, unreadCount: 0, total: 0 } });
  assert.match(html, /ไม่พบรายการในหมวดนี้/);
  assert.doesNotMatch(html, /ยังไม่มีการแจ้งเตือน/);
  assert.match(html, /aria-label="ย้อนกลับ"/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test("date groups and relative time follow observation time across Bangkok midnight", async () => {
  const item = { id: "00000000-0000-4000-8000-000000000001", bookingId: "1", propertyId: "100", title: "House", checkIn: "2026-10-23", checkOut: "2026-10-24", status: "waiting", source: "internal" as const, eventType: "booking_created" as const, createdAt: "2026-10-22T16:59:00Z", bookingUpdatedAt: "2026-10-22T16:59:00Z", readAt: null };
  const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { observedAt: "2026-10-22T17:01:00Z", data: { ...inbox, items: [item], asOf: "2026-10-22T16:59:30Z", nextCursor: null } });
  assert.match(html, /เมื่อวาน/);
  assert.match(html, /2 นาทีที่แล้ว/);
});

test("inbox identifies each lifecycle event rather than labeling all items as new bookings", async () => {
  for (const [eventType, label] of [["payment_succeeded", "ชำระเงิน booking สำเร็จ"], ["booking_cancelled", "ยกเลิก booking"], ["payment_expired", "booking หมดเวลาชำระเงิน"]] as const) {
    const item = { id: "00000000-0000-4000-8000-000000000001", bookingId: "1", propertyId: "100", title: "Test house", checkIn: "2026-10-23", checkOut: "2026-10-24", status: "cancelled", source: "internal" as const, eventType, createdAt: "2026-10-22T12:00:00Z", bookingUpdatedAt: "2026-10-22T12:00:00Z", readAt: null };
    const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, items: [item], total: 1 } });
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, /มี booking ใหม่/);
    assert.match(html, /สถานะปัจจุบัน/);
    assert.match(html, /วันนี้/);
    assert.match(html, /ดูรายละเอียด/);
    assert.match(html, /aria-label="ยังไม่อ่าน"/);
  }
});
