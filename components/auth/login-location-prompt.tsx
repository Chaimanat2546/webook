"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { LOGIN_LOCATION_WINDOW_MS } from "../../lib/login-history";
import { Button } from "../ui/button";
import { createLoginLocationRequest, matchesLoginLocationSession } from "./login-location-request";
import { sendLoginLocation } from "./login-location-transport";

interface LoginLocationPromptProps { historyId: string; userId: string; sessionId: string; expiresAt: number }

export function LoginLocationPrompt({ historyId, userId, sessionId, expiresAt }: LoginLocationPromptProps) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const flow = useRef<ReturnType<typeof createLoginLocationRequest> | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(`webook-location-attempt:${historyId}`) === "1") { router.replace("/"); return; }
    } catch { /* Marker only; no location values are stored. */ }
    const request = createLoginLocationRequest({
      historyId, minimumCapturedAt: expiresAt - LOGIN_LOCATION_WINDOW_MS,
      geolocation: navigator.geolocation ?? null,
      onState(state) { if (state === "reading") setWaiting(true); },
      onContinue() { router.replace("/"); }, save: sendLoginLocation,
    });
    flow.current = request;
    const client = createSupabaseBrowserClient();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!matchesLoginLocationSession(session,userId,sessionId)) { request.cancel(); router.replace("/"); }
    });
    const expiry = setTimeout(() => { request.cancel(); router.replace("/"); }, Math.max(0, expiresAt - Date.now()));
    return () => { request.cancel(); flow.current = null; clearTimeout(expiry); data.subscription.unsubscribe(); };
  }, [historyId, userId, sessionId, expiresAt, router]);

  function choose(share: boolean) {
    if (attempted.current || !flow.current) return;
    attempted.current = true;
    try { sessionStorage.setItem(`webook-location-attempt:${historyId}`, "1"); } catch { /* Optional marker. */ }
    if (share) flow.current.share(); else flow.current.skip();
  }

  return <section aria-labelledby="location-title" className="w-full rounded-2xl border bg-card px-6 py-7 text-center shadow-sm">
    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/[0.02] text-primary-text"><MapPin aria-hidden className="size-7" /></div>
    <h1 id="location-title" className="text-xl font-semibold">ก่อนเริ่มใช้งาน</h1>
    <p className="mx-auto mt-2 max-w-[280px] text-[15px] leading-relaxed font-medium">อนุญาตให้บันทึกตำแหน่งของการเข้าสู่ระบบครั้งนี้หรือไม่</p>
    <p className="mx-auto mt-3 max-w-[270px] text-sm leading-relaxed text-muted-foreground">ใช้เป็นหลักฐานในประวัติความปลอดภัยของบัญชี</p>
    <div className="mt-8 flex flex-col gap-2.5">
      <Button type="button" className="h-12 w-full rounded-lg text-base" disabled={waiting} onClick={() => choose(true)}>อนุญาต</Button>
      <Button type="button" variant="ghost" className="h-10 w-full text-muted-foreground" disabled={waiting} onClick={() => choose(false)}>ข้าม</Button>
    </div>
    <p role="status" aria-live="polite" className="sr-only">{waiting ? "กำลังรอสิทธิ์และตำแหน่งจากอุปกรณ์" : ""}</p>
  </section>;
}
