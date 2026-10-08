import "server-only";
import type { AnalyticsPeriod, AnalyticsSite, SiteReportResult } from "../../lib/website-analytics.ts";
import { resolveAnalyticsSite } from "./registry.ts";
import { readAnalyticsToken } from "./credentials.ts";
import { parseSourceReport } from "./report.ts";

export interface AnalyticsClientDependencies {
  fetch?: typeof fetch;
  token?: (site: AnalyticsSite) => Promise<string | null>;
  timeoutMs?: number;
}
const MAX_BYTES = 3 * 1024 * 1024;
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("invalid_report");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw Error("invalid_report"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
export async function fetchSiteReport(site: AnalyticsSite, period: AnalyticsPeriod, dependencies: AnalyticsClientDependencies = {}): Promise<SiteReportResult> {
  const allowed = resolveAnalyticsSite(site.key);
  if (!allowed || allowed.origin !== site.origin || allowed.siteId !== site.siteId) return { ok: false, reason: "unavailable" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let received = false;
  try {
    const token = await (dependencies.token ?? readAnalyticsToken)(allowed);
    if (!token) return { ok: false, reason: "not_configured" };
    timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 10000);
    const response = await (dependencies.fetch ?? fetch)(`${allowed.origin}/api/analytics/v1/report`, {
      method: "POST", redirect: "manual", cache: "no-store", signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(period),
    });
    received = true;
    if (!response.ok) {
      console.warn("analytics_upstream_http", { site: allowed.key, status: response.status });
      await response.body?.cancel();
      return { ok: false, reason: response.status === 401 || response.status === 403 ? "unauthorized" : response.status === 429 ? "rate_limited" : "unavailable" };
    }
    return { ok: true, report: parseSourceReport(await boundedJson(response), allowed, period) };
  } catch (error) {
    console.warn("analytics_upstream_failure", { site: allowed.key, aborted: controller.signal.aborted, received, error: error instanceof Error ? error.name : "unknown" });
    return { ok: false, reason: controller.signal.aborted ? "timeout" : received ? "invalid_report" : "unavailable" };
  } finally { if (timer) clearTimeout(timer); }
}
