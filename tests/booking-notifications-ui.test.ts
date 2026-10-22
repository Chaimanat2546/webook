import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import type { NotificationsContextValue } from "../components/admin/notifications/notifications-context.tsx";

async function render(entry: string, exported: string, overrides: Partial<NotificationsContextValue> = {}) {
  const state: NotificationsContextValue = { data: null, actorId: "actor", loading: false, error: null, open: true, setOpen() {}, page: 1, setPage() {}, refresh: async () => {}, markRead: async () => true, cleanupDevice: async () => true, ...overrides };
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
    if (id === "navigation-fixture") return { useRouter: () => ({ push() {} }) };
    if (id === "sidebar-fixture") return { SidebarMenuItem: wrapper, SidebarMenuButton: wrapper };
    if (id === "push-fixture") return { PushSettings: () => null };
    if (id === "sheet-fixture") return { Sheet: ({ children }: { children: ReactNode }) => createElement("div", null, children), SheetContent: wrapper, SheetHeader: wrapper, SheetTitle: wrapper, SheetDescription: wrapper };
    return require(id);
  }, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports[exported] as ComponentType));
}

const inbox = { actorId: "actor", items: [], unreadCount: 123, total: 41, page: 1, pageSize: 20, asOf: "2026-10-22T12:00:00Z", pushPublicKey: null };

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

test("inbox supports loading, empty and paginated states", async () => {
  const loading = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { loading: true });
  assert.match(loading, /aria-label="กำลังโหลดการแจ้งเตือน"/);
  const empty = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, total: 0, unreadCount: 0 } });
  assert.match(empty, /ยังไม่มีการแจ้งเตือน/);
  const paginated = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: inbox });
  assert.match(paginated, /หน้า 1 \/ 3/);
  assert.match(paginated, /aria-label="หน้าถัดไป"/);
});

test("inbox identifies each lifecycle event rather than labeling all items as new bookings", async () => {
  for (const [eventType, label] of [["payment_succeeded", "ชำระเงิน booking สำเร็จ"], ["booking_cancelled", "ยกเลิก booking"], ["payment_expired", "booking หมดเวลาชำระเงิน"]] as const) {
    const item = { id: "00000000-0000-4000-8000-000000000001", bookingId: "1", propertyId: "100", title: "Test house", checkIn: "2026-10-23", checkOut: "2026-10-24", status: "cancelled", source: "internal" as const, eventType, createdAt: "2026-10-22T12:00:00Z", bookingUpdatedAt: "2026-10-22T12:00:00Z", readAt: null };
    const html = await render("components/admin/notifications/notifications-sheet.tsx", "NotificationsSheet", { data: { ...inbox, items: [item], total: 1 } });
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, /มี booking ใหม่/);
    assert.match(html, /สถานะปัจจุบัน/);
  }
});
