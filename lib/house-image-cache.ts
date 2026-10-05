import { awsImageHostname } from "./aws-image-url.ts";

export const HOUSE_IMAGE_CACHE_MAX_AGE_SECONDS = 12 * 60 * 60;
const HOUSE_IMAGE_WORKER_HOSTNAME = "webook-media.poolvilla.workers.dev";

export interface HouseImageCacheRequest {
  url: string;
  method: string;
  destination: string;
}

export function shouldCacheHouseImageRequest({ url, method, destination }: HouseImageCacheRequest): boolean {
  if (method !== "GET" || destination !== "image") return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === awsImageHostname) return parsed.pathname.length > 1 && !parsed.pathname.slice(1).includes("/");
    return parsed.hostname === HOUSE_IMAGE_WORKER_HOSTNAME && parsed.pathname.startsWith("/houses/") && parsed.pathname.length > "/houses/".length;
  } catch {
    return false;
  }
}
