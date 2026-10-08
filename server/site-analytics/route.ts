import "server-only";
import { parseWebsiteAnalyticsQuery, WebsiteAnalyticsError, type AnalyticsSite, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../lib/website-analytics.ts";
import { requireWebsiteAnalyticsAccess } from "../auth/website-analytics.ts";
import { loadWebsiteAnalytics } from "../services/website-analytics.ts";
import { listAnalyticsSites } from "./registry.ts";

interface WebsiteAnalyticsRouteDependencies {
  authorize?: () => Promise<void>;
  sites?: () => AnalyticsSite[];
  now?: () => Date;
  load?: (query: WebsiteAnalyticsQuery, now: Date) => Promise<WebsiteAnalyticsReport>;
}
export async function handleWebsiteAnalyticsRequest(request: Request, dependencies: WebsiteAnalyticsRouteDependencies = {}): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    await (dependencies.authorize ?? requireWebsiteAnalyticsAccess)();
    const raw: Record<string, unknown> = Object.create(null);
    for (const [key, value] of new URL(request.url).searchParams) {
      if (Object.hasOwn(raw, key)) throw new WebsiteAnalyticsError("invalid_query", 400);
      Object.defineProperty(raw, key, { value, enumerable: true });
    }
    const now = (dependencies.now ?? (() => new Date()))();
    const query = parseWebsiteAnalyticsQuery(raw, (dependencies.sites ?? listAnalyticsSites)().map(site => site.key), now);
    const report = await (dependencies.load ?? ((query, snapshot) => loadWebsiteAnalytics(query, { now: () => snapshot })))(query, now);
    return Response.json(report, { status: report.status === "unavailable" ? 503 : 200, headers });
  } catch (error) {
    return Response.json({ error: error instanceof WebsiteAnalyticsError ? error.code : "unavailable" }, { status: error instanceof WebsiteAnalyticsError ? error.status : 503, headers });
  }
}
