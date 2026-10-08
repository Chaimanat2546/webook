import { handleWebsiteAnalyticsRequest } from "../../../../server/site-analytics/route";

export async function GET(request: Request) {
  return handleWebsiteAnalyticsRequest(request);
}
