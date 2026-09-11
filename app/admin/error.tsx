"use client";

import { PageError } from "../../components/pwa/page-error";
import { AdminFallbackBack } from "../../components/layout/admin-fallback-back";

export default function AdminError({ reset }: { reset: () => void }) {
  return <><PageError reset={reset} /><div className="mx-auto max-w-xl px-4"><AdminFallbackBack /></div></>;
}
