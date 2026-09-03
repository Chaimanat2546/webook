import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { getSupabaseEnv } from "../env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const { anonKey, url } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    global: {
      headers: getOriginalClientHeaders(requestHeaders),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; Server Actions can.
        }
      },
    },
  });
}

function getOriginalClientHeaders(requestHeaders: Headers): Record<string, string> {
  const headersToForward: Record<string, string> = {};
  const clientIp =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = requestHeaders.get("user-agent")?.trim();

  if (clientIp) {
    headersToForward["x-webook-origin-ip"] = clientIp;
  }

  if (userAgent) {
    headersToForward["x-webook-origin-user-agent"] = userAgent;
  }

  return headersToForward;
}
