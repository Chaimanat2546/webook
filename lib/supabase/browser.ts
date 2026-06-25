"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "../env";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
