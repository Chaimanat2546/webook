"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { createLoginLocationRequest, type LocationRequestState } from "./login-location-request";

const savedWithoutCoordinates:Partial<Record<LocationRequestState,string>>={
  denied:"บันทึกประวัติแล้ว แต่ยังไม่ได้พิกัด: อุปกรณ์หรือเบราว์เซอร์ไม่อนุญาตให้อ่านตำแหน่ง กรุณาตรวจสิทธิ์ตำแหน่ง แล้วเข้าสู่ระบบใหม่หากต้องการลองอีกครั้ง",
  unavailable:"บันทึกประวัติแล้ว แต่เครื่องยังอ่านพิกัดไม่ได้ คุณเข้าสู่ระบบต่อได้",
  timeout:"บันทึกประวัติแล้ว แต่หมดเวลารอพิกัด คุณเข้าสู่ระบบต่อได้",
  unsupported:"บันทึกประวัติแล้ว แต่เบราว์เซอร์นี้ไม่รองรับการอ่านพิกัด คุณเข้าสู่ระบบต่อได้",
};

function subscribeAttemptMarker(changed:()=>void) {
  window.addEventListener("storage",changed);
  return()=>window.removeEventListener("storage",changed);
}

export function LoginLocationPrompt({historyId,userId,expiresAt}:{historyId:string;userId:string;expiresAt:number}) {
  const router=useRouter();
  const [state,setState]=useState<LocationRequestState>("idle");
  const [failureStatus,setFailureStatus]=useState<number | null>(null);
  const [attempted,setAttempted]=useState(false);
  const [expired,setExpired]=useState(false);
  const flow=useRef<ReturnType<typeof createLoginLocationRequest> | null>(null);
  const attemptKey=`webook-location-attempt:${historyId}`;
  const previouslyAttempted=useSyncExternalStore(subscribeAttemptMarker,()=>{
    try{return sessionStorage.getItem(attemptKey)==="1";}catch{return false;}
  },()=>false);
  const blocked=attempted || previouslyAttempted;
  useEffect(()=>{
    const request=createLoginLocationRequest({historyId,geolocation:navigator.geolocation ?? null,onState(next){setState(next);if(next==="saved")router.replace("/");},save:async(report,signal)=>{
      const response=await fetch("/api/login-history/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(report),credentials:"same-origin",cache:"no-store",signal});
      setFailureStatus(response.ok?null:response.status);
      return response.ok;
    }});
    flow.current=request;
    const client=createSupabaseBrowserClient();
    const {data}=client.auth.onAuthStateChange((_event,session)=>{
      if(session?.user.id!==userId){request.cancel();router.replace("/");}
    });
    const expiry=setTimeout(()=>{request.cancel();setExpired(true);},Math.max(0,expiresAt-Date.now()));
    return()=>{request.cancel();flow.current=null;clearTimeout(expiry);data.subscription.unsubscribe();};
  },[historyId,userId,expiresAt,attemptKey,router]);
  const busy=state==="reading" || state==="saving";
  function share(){
    if(blocked || expired)return;
    try {sessionStorage.setItem(attemptKey,"1");}catch{/* Optional attempt marker only. */}
    setAttempted(true);flow.current?.share();
  }
  return <Card className="w-full max-w-md">
    <CardHeader className="space-y-2">
      <MapPin aria-hidden className="size-8 text-primary" />
      <CardTitle className="text-xl">แชร์ตำแหน่งสำหรับการเข้าสู่ระบบครั้งนี้</CardTitle>
      <CardDescription className="leading-relaxed">ระบบจะเก็บตำแหน่งครั้งนี้เพื่อประกอบประวัติการเข้าสู่ระบบ คุณข้ามได้โดยยังใช้งานระบบได้ ระบบไม่ติดตามตำแหน่งต่อเนื่อง</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">เมื่อเลือกแชร์ เบราว์เซอร์จะขอสิทธิ์เข้าถึงตำแหน่ง เก็บพิกัดพร้อมความแม่นยำ 90 วัน คุณดูประวัติตนเองได้ และผู้ดูแลหลักเข้าถึงประวัติเพื่อตรวจสอบได้</p>
      <div aria-live="polite" role="status" className="text-sm">
        {busy?<p className="flex items-center gap-2"><LoaderCircle aria-hidden className="size-4 animate-spin" />{state==="reading"?"กำลังรอผลพิกัด…":"กำลังบันทึกผล…"}</p>:null}
        {state==="saved"?<p>บันทึกผลแล้ว กำลังเข้าสู่ระบบ…</p>:null}
      </div>
      {savedWithoutCoordinates[state]?<Alert><AlertDescription>{savedWithoutCoordinates[state]}</AlertDescription></Alert>:null}
      {state==="failed"?<Alert variant="destructive"><AlertDescription>{failureStatus===401?"การเข้าสู่ระบบนี้หมดอายุหรือถูกออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่":failureStatus===404?"ประวัติบนหน้านี้ไม่ตรงกับการเข้าสู่ระบบปัจจุบัน กรุณาเปิดหน้าขอพิกัดใหม่":`ยังบันทึกผลไม่ได้${failureStatus?` (HTTP ${failureStatus})`:""} คุณเข้าสู่ระบบต่อได้ หรือลองส่งผลเดิมอีกครั้ง`}</AlertDescription></Alert>:null}
      {expired?<Alert><AlertDescription>หมดเวลารับพิกัดสำหรับรายการนี้แล้ว คุณเข้าสู่ระบบต่อได้</AlertDescription></Alert>:null}
      {blocked && state==="idle"?<p className="text-sm text-muted-foreground">เคยขอพิกัดสำหรับรายการนี้แล้ว ระบบจะไม่อ่านซ้ำหลังโหลดหน้าใหม่</p>:null}
      <div className="flex flex-col gap-2">
        {state==="idle" && !expired?<>
          <Button type="button" className="min-h-11" disabled={blocked} onClick={share}>แชร์ตำแหน่งครั้งนี้</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={()=>flow.current?.skip()}>ข้าม</Button>
        </>:null}
        {state==="failed" && !expired?(failureStatus===401
          ? <Button asChild><a href="/login">เข้าสู่ระบบใหม่</a></Button>
          : failureStatus===404
          ? <Button asChild><a href="/login/location">เปิดหน้าขอพิกัดใหม่</a></Button>
          : <Button type="button" onClick={()=>flow.current?.retry()}>ลองส่งผลอีกครั้ง</Button>):null}
        <Button asChild variant="ghost" className="min-h-11"><Link href="/">เข้าสู่ระบบต่อ</Link></Button>
      </div>
    </CardContent>
  </Card>;
}
