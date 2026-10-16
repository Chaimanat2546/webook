// Local HTTP integration: real producer validation/guard/RPC -> Webook client/service.
// Owns a disposable database; never reads .env or connects to a remote database.
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fetchSiteReport } from "../server/site-analytics/client.ts";
import { loadWebsiteSummaryPeriods } from "../server/services/website-analytics-comparison.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { analyticsDateRange, parseWebsiteAnalyticsQuery } from "../lib/website-analytics.ts";
import { parseWebsiteScope } from "../lib/website-analytics-scope.ts";
import { sites } from "../tests/fixtures/website-analytics.ts";

const producer = resolve(process.argv[2] ?? "");
const container = process.argv[3];
const serve = process.argv.includes("--serve");
if (!container || !/^supabase_db_[A-Za-z0-9_-]+$/.test(container) || !process.argv[2]) throw Error("Pass producer checkout and local supabase_db_ container");
const database = `webook_hourly_test_${process.pid}`;
const token = "fixture-only-report-token-for-local-tests";
const site = sites[0], now = new Date("2026-10-16T04:00:00.000Z");
function docker(args, input) {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || "Local Docker query failed");
  return result.stdout.trim();
}
function sql(statement) { return docker(["psql", "-U", "postgres", "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], statement); }
const validationBundle = await build({ entryPoints: [join(producer, "lib/analytics/validation.ts")], bundle: true, write: false, platform: "node", format: "esm" });
const { validateReportQuery } = await import("data:text/javascript;base64," + Buffer.from(validationBundle.outputFiles[0].contents).toString("base64"));
const { guardAnalyticsRequest } = await import(pathToFileURL(join(producer, "worker-analytics-access.js")).href);
const base = await readFile(join(producer, "supabase/migrations/20261006000000_create_site_analytics.sql"), "utf8");
const upgrade = await readFile(join(producer, "supabase/migrations/20261016000000_add_hourly_site_analytics.sql"), "utf8");
docker(["createdb", "-U", "postgres", database]);
let server;
function cleanup() { if (server) server.close(); docker(["dropdb", "-U", "postgres", database]); }
try {
  sql(base + upgrade + `
    select private.analytics_initialize('${site.siteId}');
    update public.analytics_metadata set data_available_from='2026-09-01T00:00:00Z';
    insert into public.analytics_events(event_id,site_id,villa_id,event_name,page_path,occurred_at)
    select gen_random_uuid(),'${site.siteId}','9','page_view','/villas/9',d::timestamptz + h*interval '1 hour' + n*interval '1 minute'
    from unnest(array['2026-10-13T17:00:00Z','2026-10-14T17:00:00Z','2026-10-15T17:00:00Z']) d
    cross join generate_series(0,23) h cross join generate_series(1,3) n where n<=h%3+1;`);
  const local = "http://127.0.0.1:3102";
  const read = (selected, period) => fetchSiteReport(selected, period, { token: async () => token, fetch: (_url, init) => fetch(local + "/api/analytics/v1/report", init) });
  const json = (response, status, value) => { response.writeHead(status, { "content-type": "application/json", "cache-control": "private, no-store" }); response.end(JSON.stringify(value)); };
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, local);
      if (url.pathname === "/api/analytics/v1/report") {
        let body = "";
        for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 16384) { json(response, 413, { error: "BODY_TOO_LARGE" }); return; } }
        const upstream = new Request(site.origin + url.pathname, { method: request.method, headers: request.headers, body });
        const denied = await guardAnalyticsRequest(upstream, { ANALYTICS_REPORT_READ_TOKEN: token }, false);
        if (denied) { response.writeHead(denied.status, Object.fromEntries(denied.headers)); response.end(await denied.text()); return; }
        const { query } = validateReportQuery(JSON.parse(body), now);
        const value = JSON.parse(sql("set role service_role; select public.analytics_report('" + JSON.stringify(query).replaceAll("'", "''") + "'::jsonb,'" + site.siteId + "')::text;"));
        json(response, 200, value); return;
      }
      if (url.pathname === "/data") {
        const params = url.searchParams;
        const from = params.get("analyticsFrom") ?? params.get("from") ?? "2026-10-15";
        const to = params.get("analyticsTo") ?? params.get("to") ?? "2026-10-15";
        const timeFrom = params.get("analyticsTimeFrom") ?? params.get("timeFrom");
        const timeTo = params.get("analyticsTimeTo") ?? params.get("timeTo");
        const query = parseWebsiteAnalyticsQuery({ month: "2026-10", from, to, site: site.key, ...(timeFrom !== null || timeTo !== null ? { timeFrom: timeFrom ?? undefined, timeTo: timeTo ?? undefined } : {}), ...(params.has("view") ? { view: params.get("view") } : {}) }, [site.key], now);
        const scope = parseWebsiteScope(params.get("analyticsScope") ?? undefined, [site.key], now);
        const report = await loadWebsiteSummaryPeriods(query, false, { now: () => now, sites: () => [site], read }, scope);
        const detail = serve ? await loadWebsiteAnalytics(query, { now: () => now, sites: () => [site], read, titles: async () => new Map([["9", "บ้านทดสอบข้อมูลรายชั่วโมง"]]) }) : undefined;
        json(response, 200, { ...report, detail, query, range: analyticsDateRange(report.period), month: "2026-10", today: "2026-10-16", scope }); return;
      }
      if (serve && url.pathname === "/bundle.js") { response.setHeader("content-type", "text/javascript"); response.end(await readFile(".superpowers/hourly/browser/bundle.js")); return; }
      if (serve && url.pathname.startsWith("/_next/static/")) {
        const root = resolve(".next/static"), file = resolve(root, "." + url.pathname.slice("/_next/static".length));
        if (!file.startsWith(root + "/") && !file.startsWith(root + "\\")) throw Error("Invalid asset");
        response.setHeader("content-type", extname(file) === ".css" ? "text/css" : "application/octet-stream"); response.end(await readFile(file)); return;
      }
      if (serve && url.pathname === "/mobile") {
        const width = Number(url.searchParams.get("width") ?? 390);
        const height = width === 360 ? 800 : width === 430 ? 932 : 844;
        if (![360, 390, 430].includes(width)) throw Error("Invalid fixture width");
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html><body style="margin:0;background:#eee"><p>Local fixture viewport ${width} × ${height} CSS px</p><iframe title="Mobile Dashboard fixture" width="${width}" height="${height}" style="border:0" src="/?analyticsFrom=2026-10-15&analyticsTo=2026-10-15&analyticsTimeFrom=09:00&analyticsTimeTo=18:00"></iframe></body></html>`); return;
      }
      if (serve && (url.pathname === "/" || url.pathname.startsWith("/admin/dashboard"))) {
        const css = (await readdir(".next/static/css")).filter(file => file.endsWith(".css")).map(file => `<link rel="stylesheet" href="/_next/static/css/${file}">`).join("");
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`); return;
      }
      json(response, 404, { error: "NOT_FOUND" });
    } catch (error) { json(response, error.status ?? 400, { error: error.code ?? error.message }); }
  });
  await new Promise(resolve => server.listen(3102, "127.0.0.1", resolve));
  const selected = { month: "2026-10", from: "2026-10-15", to: "2026-10-15", timeFrom: "09:00", timeTo: "18:00", site: "all", page: 1 };
  const report = await loadWebsiteSummaryPeriods(selected, false, { now: () => now, sites: () => [site], read });
  assert.equal(report.sites[0].hourly.length, 9);
  assert.equal(report.sites[0].totals.page_views, 18);
  const midnight = await loadWebsiteSummaryPeriods({ ...selected, timeFrom: "23:00", timeTo: "24:00" }, false, { now: () => now, sites: () => [site], read });
  assert.equal(midnight.sites[0].totals.page_views, 3);
  const denied = await fetch(local + "/api/analytics/v1/report", { method: "POST", body: "{}" });
  assert.equal(denied.status, 401);
  console.log("PASS: real producer SQL + validation + HTTP guard -> Webook client/parser/service; 9 selected hours=18 views; 23–24=3; unauthorized=401");
  if (serve) {
    console.log("Local fixture browser: http://127.0.0.1:3102 (owns disposable DB; Ctrl+C cleans up)");
    process.once("SIGINT", () => { cleanup(); process.exit(0); });
    process.once("SIGTERM", () => { cleanup(); process.exit(0); });
    await new Promise(() => {});
  }
} finally { cleanup(); }
