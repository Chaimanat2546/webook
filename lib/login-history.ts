export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type LoginLocationStatus = "pending" | "success" | "skipped" | "denied" | "unavailable" | "timeout" | "unsupported";
export interface LoginActor { userId: string; sessionId: string }
export interface RecordLoginInput extends LoginActor {
  loggedInAt: string; ipAddress: string | null; os: string; browser: string; deviceType: DeviceType;
}
export type LocationReport =
  | { historyId: string; status: "success"; latitude: number; longitude: number; accuracy: number; capturedAt: string }
  | { historyId: string; status: Exclude<LoginLocationStatus, "pending" | "success"> };
export interface LoginHistoryEntry {
  id: string; userId: string; loggedInAt: string; ipAddress: string | null;
  os: string; browser: string; deviceType: DeviceType; locationStatus: LoginLocationStatus;
  latitude: number | null; longitude: number | null; accuracy: number | null;
  capturedAt: string | null; receivedAt: string | null;
  displayName: string | null; username: string | null; email: string | null;
}
export type HistoryScope = { kind: "self" | "root-admin"; userId: string };
export type HistorySort = "latest" | "oldest";
export interface HistoryFilter { search: string; from: string | null; to: string | null; status: LoginLocationStatus | null; sort: HistorySort; page: number; pageSize: number }
export interface HistoryPage { entries: LoginHistoryEntry[]; total: number; page: number; pageSize: number }
export class LoginHistoryError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 503;
  readonly transient: boolean;
  readonly reason: "invalid_capture_time" | "invalid_date" | null;
  constructor(status: LoginHistoryError["status"], transient = false, reason: LoginHistoryError["reason"] = null) {
    super("login_history_failed"); this.status = status; this.transient = transient; this.reason = reason;
  }
}
export const LOGIN_LOCATION_WINDOW_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isLoginUuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
export function asLoginRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LoginHistoryError(400);
  return value as Record<string, unknown>;
}
export function actorFromClaims(claims: unknown, verifiedUserId: string): LoginActor {
  const record = asLoginRecord(claims);
  if (record.sub !== verifiedUserId || !isLoginUuid(record.sub) || !isLoginUuid(record.session_id)) throw new LoginHistoryError(401);
  return { userId: record.sub, sessionId: record.session_id };
}
export function parseLocationReport(value: unknown): LocationReport {
  const row = asLoginRecord(value);
  if (!isLoginUuid(row.historyId)) throw new LoginHistoryError(400);
  const keys = row.status === "success" ? ["historyId","status","latitude","longitude","accuracy","capturedAt"] : ["historyId","status"];
  if (Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => !(key in row))) throw new LoginHistoryError(400);
  if (row.status === "success") {
    const { latitude, longitude, accuracy, capturedAt } = row;
    if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0
      || typeof capturedAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) throw new LoginHistoryError(400);
    return { historyId: row.historyId, status: "success", latitude, longitude, accuracy, capturedAt: new Date(capturedAt).toISOString() };
  }
  if (row.status !== "skipped" && row.status !== "denied" && row.status !== "unavailable" && row.status !== "timeout" && row.status !== "unsupported") throw new LoginHistoryError(400);
  return { historyId: row.historyId, status: row.status };
}
function dayStart(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new LoginHistoryError(400, false, "invalid_date");
  const utc = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0,10) !== value) throw new LoginHistoryError(400, false, "invalid_date");
  return utc - 7*60*60*1000;
}
export function parseHistoryFilter(query: Record<string, string | undefined>): HistoryFilter {
  const integer = (value: string | undefined, fallback: number, maximum: number) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) throw new LoginHistoryError(400);
    return Number(value);
  };
  const from = query.from ? dayStart(query.from) : null;
  const to = query.to ? dayStart(query.to) + 24*60*60*1000 : null;
  const search = (query.q ?? "").trim();
  if (from !== null && to !== null && from >= to) throw new LoginHistoryError(400, false, "invalid_date");
  const status = query.status || null;
  const sort = query.sort || "latest";
  if (search.length > 200 || (status !== null && !Object.hasOwn(LOCATION_STATUS_LABELS, status)) || (sort !== "latest" && sort !== "oldest")) throw new LoginHistoryError(400);
  return { search, from: from === null ? null : new Date(from).toISOString(), to: to === null ? null : new Date(to).toISOString(), status: status as LoginLocationStatus | null, sort, page: integer(query.page,1,1000000), pageSize: integer(query.pageSize,25,100) };
}
export function classifyLoginDevice(userAgent: string | null): Pick<RecordLoginInput,"os" | "browser" | "deviceType"> {
  const ua = (userAgent ?? "").slice(0,2048);
  const os = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "unknown";
  const browser = /Edg(?:e|A|iOS)?\//i.test(ua) ? "Edge" : /OPR\//i.test(ua) ? "Opera" : /Firefox|FxiOS/i.test(ua) ? "Firefox" : /Chrome|CriOS/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "unknown";
  const deviceType: DeviceType = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet" : /Mobile|iPhone|iPod/i.test(ua) ? "mobile" : os !== "unknown" ? "desktop" : "unknown";
  return { os, browser, deviceType };
}
export const LOCATION_STATUS_LABELS: Record<LoginLocationStatus,string> = {
  pending: "ไม่ได้รับข้อมูลพิกัด", success: "ได้รับพิกัด", skipped: "ผู้ใช้ข้าม", denied: "ไม่อนุญาต",
  unavailable: "อ่านพิกัดไม่ได้", timeout: "หมดเวลา", unsupported: "อุปกรณ์ไม่รองรับ",
};
