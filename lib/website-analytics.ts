export const WEBSITE_ANALYTICS_SORTS = [
  { value: "contacts", label: "การติดต่อ", heading: "บ้านที่มีการกดติดต่อสูงสุด", direction: "มากไปน้อย" },
  { value: "gallery", label: "การเปิดรูป", heading: "บ้านที่มีการเปิดรูปสูงสุด", direction: "มากไปน้อย" },
  { value: "views", label: "การเข้าชม", heading: "บ้านที่มีการเข้าชมสูงสุด", direction: "มากไปน้อย" },
  { value: "name", label: "ชื่อบ้าน", heading: "บ้านเรียงตามชื่อ", direction: "ตามตัวอักษร" },
  { value: "code", label: "รหัสบ้าน", heading: "บ้านเรียงตามรหัส", direction: "น้อยไปมาก" },
] as const;
export type WebsiteAnalyticsSort = typeof WEBSITE_ANALYTICS_SORTS[number]["value"];
export interface WebsiteAnalyticsQuery { month: string; site: string; page: number; search?: string; sort?: WebsiteAnalyticsSort; view?: "houses"; granularity?: "day" | "month"; pages?: Record<string, number> }
export interface AnalyticsMonth { date: string; page_views: number | null; contact_clicks: number | null; status: "complete" | "partial" | "unavailable" | "no_data" }
export interface AnalyticsPeriod {
  from_date: string; to_date: string; timezone: "Asia/Bangkok";
  as_of: string; contract_version: "1.0"; villa_id: null;
}
export interface AnalyticsMetrics {
  page_views: number; phone_clicks: number; chat_clicks: number;
  line_clicks: number; gallery_opens: number; contact_clicks: number;
}
export const METRIC_KEYS = ["page_views", "phone_clicks", "chat_clicks", "line_clicks", "gallery_opens", "contact_clicks"] as const;
export interface AnalyticsDay extends AnalyticsMetrics { date: string }
export interface AnalyticsVilla extends AnalyticsMetrics { villa_id: string }
export interface AnalyticsSite { key: string; siteId: string; displayName: string; origin: string }
export interface AnalyticsCoverage { data_available_from: string; range_complete: boolean; rows_complete: boolean }
export interface SourceReport {
  totals: AnalyticsMetrics; unattributed: AnalyticsMetrics;
  daily: AnalyticsDay[]; villas: AnalyticsVilla[]; coverage: AnalyticsCoverage;
}
export type SiteFailureReason = "not_configured" | "unauthorized" | "rate_limited" | "timeout" | "unavailable" | "invalid_report";
export type SiteReportResult = { ok: true; report: SourceReport } | { ok: false; reason: SiteFailureReason };
export interface WebsiteSummary {
  key: string; displayName: string; origin: string; status: "complete" | "partial" | SiteFailureReason;
  totals: AnalyticsMetrics | null; coverage: AnalyticsCoverage | null;
  unattributed?: AnalyticsMetrics; villas?: { rows: WebsiteVilla[]; page: number; total: number };
}
export interface WebsiteVilla extends AnalyticsVilla { siteKey: string; siteName: string; title?: string }
export interface WebsiteAnalyticsReport {
  period: AnalyticsPeriod; status: "complete" | "partial" | "unavailable";
  availableSites: number; selectedSites: number; totals: AnalyticsMetrics | null;
  unattributed: AnalyticsMetrics | null; daily: AnalyticsDay[]; websites: WebsiteSummary[];
  villas: { rows: WebsiteVilla[]; page: number; pageSize: 10; total: number };
  monthly?: AnalyticsMonth[];
  nameSortUnavailable?: boolean;
  searchUnavailable?: boolean;
}
export class WebsiteAnalyticsError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}
export function emptyMetrics(): AnalyticsMetrics {
  return { page_views: 0, phone_clicks: 0, chat_clicks: 0, line_clicks: 0, gallery_opens: 0, contact_clicks: 0 };
}
export function addMetrics(a: AnalyticsMetrics, b: AnalyticsMetrics): AnalyticsMetrics {
  const result = emptyMetrics();
  for (const key of METRIC_KEYS) {
    const sum = a[key] + b[key];
    if (!Number.isSafeInteger(sum) || sum < 0) throw new WebsiteAnalyticsError("invalid_report", 503);
    result[key] = sum;
  }
  return result;
}
export function parseWebsiteAnalyticsQuery(raw: Record<string, unknown>, allowedKeys: readonly string[], now: Date, options: { singleSite?: boolean } = {}): WebsiteAnalyticsQuery {
  const allowed = ["month", "site", "page", "granularity", "view", "sort", "search", ...allowedKeys.map(key => `page_${key}`)];
  if (Object.keys(raw).some(key => !allowed.includes(key))) throw new WebsiteAnalyticsError("invalid_query", 400);
  const current = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 7);
  const month = raw.month ?? current, site = raw.site ?? "all", page = raw.page ?? "1";
  if (typeof month !== "string" || !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(month) || month > current ||
      typeof site !== "string" || (site !== "all" && !allowedKeys.includes(site)) ||
      typeof page !== "string" || !/^[1-9]\d{0,15}$/.test(page) || !Number.isSafeInteger(Number(page))) {
    throw new WebsiteAnalyticsError("invalid_query", 400);
  }
  if (raw.granularity !== undefined && raw.granularity !== "day" && raw.granularity !== "month") throw new WebsiteAnalyticsError("invalid_query", 400);
  if (raw.view !== undefined && raw.view !== "houses") throw new WebsiteAnalyticsError("invalid_query", 400);
  if (raw.search !== undefined && (typeof raw.search !== "string" || raw.search.length > 100)) throw new WebsiteAnalyticsError("invalid_query", 400);
  const search = typeof raw.search === "string" ? raw.search.trim() : "";
  const sort = WEBSITE_ANALYTICS_SORTS.find(option => option.value === raw.sort)?.value;
  if (raw.sort !== undefined && !sort) throw new WebsiteAnalyticsError("invalid_query", 400);
  const pages: Record<string, number> = Object.create(null);
  for (const key of allowedKeys) {
    const value = raw[`page_${key}`];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value) || !Number.isSafeInteger(Number(value))) throw new WebsiteAnalyticsError("invalid_query", 400);
    pages[key] = Number(value);
  }
  const selectedSite = options.singleSite && site === "all" ? allowedKeys[0] : site;
  if (!selectedSite) throw new WebsiteAnalyticsError("invalid_query", 400);
  return { month, site: selectedSite, page: Number(page), ...(search ? { search } : {}), ...(sort ? { sort } : {}), ...(raw.view === "houses" ? { view: "houses" as const } : {}), ...(raw.granularity ? { granularity: raw.granularity } : {}), ...(Object.keys(pages).length ? { pages: { ...pages } } : {}) };
}
export function analyticsPeriod(query: WebsiteAnalyticsQuery, now: Date): AnalyticsPeriod {
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const [year, month] = query.month.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { from_date: `${query.month}-01`, to_date: last < today ? last : today, timezone: "Asia/Bangkok", as_of: now.toISOString(), contract_version: "1.0", villa_id: null };
}
export function websiteAnalyticsHref(query: WebsiteAnalyticsQuery, changes: Partial<WebsiteAnalyticsQuery> = {}): string {
  const next = { ...query, ...changes };
  if (changes.month !== undefined || changes.site !== undefined || changes.sort !== undefined || changes.search !== undefined) { next.page = 1; next.pages = {}; }
  const params = new URLSearchParams({ month: next.month, site: next.site });
  if (next.page !== 1) params.set("page", String(next.page));
  if (next.view === "houses") params.set("view", "houses");
  if (next.granularity === "month") params.set("granularity", "month");
  if (next.search?.trim()) params.set("search", next.search.trim());
  if (next.sort) params.set("sort", next.sort);
  for (const [key, page] of Object.entries(next.pages ?? {})) if (page !== 1) params.set(`page_${key}`, String(page));
  return `/admin/dashboard/websites?${params}`;
}

const houseCodeOrder = new Intl.Collator("en", { numeric: true });
const houseNameOrder = new Intl.Collator("th", { numeric: true, sensitivity: "base" });
export function compareWebsiteVillas(a: WebsiteVilla, b: WebsiteVilla, sort: WebsiteAnalyticsSort): number {
  let difference = 0;
  switch (sort) {
    case "contacts": difference = b.contact_clicks - a.contact_clicks; break;
    case "gallery": difference = b.gallery_opens - a.gallery_opens; break;
    case "views": difference = b.page_views - a.page_views; break;
    case "name": difference = a.title && b.title ? houseNameOrder.compare(a.title, b.title) : a.title ? -1 : b.title ? 1 : 0; break;
  }
  return difference || houseCodeOrder.compare(a.villa_id, b.villa_id) || a.siteKey.localeCompare(b.siteKey);
}


export function matchesWebsiteVilla(villa: WebsiteVilla, search: string): boolean {
  const text = search.normalize("NFKC").trim().toLocaleLowerCase("th");
  const code = text.replace(/^dv[ -]*/, "");
  if (/^\d+$/.test(code)) return villa.villa_id === code.replace(/^0+(?=\d)/, "");
  return (villa.title ?? "").normalize("NFKC").toLocaleLowerCase("th").includes(text);
}
