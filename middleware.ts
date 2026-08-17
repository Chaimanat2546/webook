import { NextResponse } from "next/server";

import { getContentSecurityPolicy } from "@/lib/security-headers";

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": getContentSecurityPolicy(process.env.NODE_ENV),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

export function middleware(): NextResponse {
  const response = NextResponse.next();

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  response.headers.delete("x-powered-by");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
