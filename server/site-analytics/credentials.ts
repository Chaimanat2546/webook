import "server-only";
import type { AnalyticsSite } from "../../lib/website-analytics.ts";

interface AnalyticsSecrets {
  ANALYTICS_REPORT_TOKEN_BAANPARTY?: string;
  ANALYTICS_REPORT_TOKEN_POOLVILLAPATTAYA?: string;
  ANALYTICS_REPORT_TOKEN_BAANPMHEE?: string;
  ANALYTICS_REPORT_TOKEN_FLUKNASA?: string;
  ANALYTICS_REPORT_TOKEN_PUKMOOD?: string;
}
function tokenFor(key: string, env: AnalyticsSecrets): string | null {
  switch (key) {
    case "baanparty": return env.ANALYTICS_REPORT_TOKEN_BAANPARTY?.trim() || null;
    case "poolvillapattaya": return env.ANALYTICS_REPORT_TOKEN_POOLVILLAPATTAYA?.trim() || null;
    case "baanpmhee": return env.ANALYTICS_REPORT_TOKEN_BAANPMHEE?.trim() || null;
    case "fluknasapoolvilla": return env.ANALYTICS_REPORT_TOKEN_FLUKNASA?.trim() || null;
    case "villamediapoolvilla": return env.ANALYTICS_REPORT_TOKEN_PUKMOOD?.trim() || null;
    default: return null;
  }
}
export async function readAnalyticsToken(site: AnalyticsSite): Promise<string | null> {
  const local = tokenFor(site.key, process.env as AnalyticsSecrets);
  if (local) return local;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return tokenFor(site.key, env as AnalyticsSecrets);
  } catch { return null; }
}
