import type { LocationReport } from "../../lib/login-history.ts";

/** Dispatch survives route unmount; the API still verifies the current session. */
export async function sendLoginLocation(report: LocationReport, signal: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/login-history/location", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report), credentials: "same-origin", cache: "no-store", keepalive: true, signal,
  });
  return response.ok;
}
