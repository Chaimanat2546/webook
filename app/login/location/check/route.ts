export const dynamic="force-dynamic";

/** A temporary browser-local probe: no auth client, history write or coordinate output. */
export function GET() {
  if(process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://sxvkhzhqtrpxgzumsswl.supabase.co"){
    return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
  }
  return new Response(`<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตรวจการขอสิทธิ์ตำแหน่ง — Staging</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;padding:24px;background:#f3f7f8;color:#17313c}main{max-width:520px;margin:24px auto;padding:24px;border:1px solid #cad9de;border-radius:16px;background:white}h1{font-size:22px}button{min-height:44px;width:100%;border:0;border-radius:8px;padding:12px;background:#075776;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;padding:12px;background:#eef4f6;border-radius:8px}a{color:#075776}</style>
</head><body><main><h1>ตรวจการขอสิทธิ์ตำแหน่ง</h1>
<p>หน้าทดสอบเฉพาะ Staging จะเรียกขอตำแหน่งตรงจากปุ่ม หน้านี้ไม่บันทึกพิกัดลงระบบ ไม่แสดง latitude/longitude และไม่แก้ประวัติล็อกอิน</p>
<button id="request" type="button">ขอสิทธิ์และอ่านตำแหน่ง</button>
<p>ใช้ขั้นตอนต่อไปนี้เฉพาะใน WeBooks test: ปุ่มด้านล่างจะยกเลิก Service Worker ของชุดทดสอบแล้วโหลดหน้านี้ใหม่ ทำให้ offline และ push ของชุดนี้หยุดทำงาน จากนั้นกดขอสิทธิ์ด้านบนอีกครั้ง และดูค่า serviceWorkerControlled ว่าเป็น false จริงหรือไม่ การถอด Worker ยังไม่ใช่วิธีแก้ที่ยืนยันแล้ว</p>
<button id="without-worker" type="button">ถอด Worker ของชุดทดสอบแล้วโหลดใหม่</button>
<p>ผลการตรวจสอบบนเครื่องนี้:</p><pre id="result" role="status" aria-live="polite"></pre>
<p>กลับหน้าล็อกอินเพื่อจดทะเบียน Worker อีกครั้ง หากเคยเปิดแจ้งเตือนในชุดทดสอบ อาจต้องเปิดแจ้งเตือนใหม่</p>
<a href="/login">กลับหน้าล็อกอิน</a></main>
<script>
const button=document.getElementById("request");
const isolationButton=document.getElementById("without-worker");
const output=document.getElementById("result");
function context(){
  let policyAllowed="unknown";
  try{const policy=document.permissionsPolicy||document.featurePolicy;if(policy)policyAllowed=policy.allowsFeature("geolocation");}catch{}
  return {probeVersion:2,secureContext:!!window.isSecureContext,topLevel:window.top===window,
    standalone:window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true,
    serviceWorkerControlled:!!navigator.serviceWorker?.controller,
    geolocationAvailable:!!navigator.geolocation,policyAllowed};
}
let result={...context(),state:"idle"};
function show(){output.textContent=JSON.stringify(result,null,2);}
function finish(values){result={...result,...values};button.disabled=false;isolationButton.disabled=!navigator.serviceWorker;show();}
isolationButton.disabled=!navigator.serviceWorker;
show();
isolationButton.addEventListener("click",async function(){
  if(isolationButton.disabled||button.disabled)return;
  isolationButton.disabled=true;button.disabled=true;
  result={...context(),state:"removing-worker"};show();
  try{
    const registration=await navigator.serviceWorker.getRegistration("/");
    const worker=registration?.active||registration?.waiting||registration?.installing;
    if(!registration||registration.scope!==window.location.origin+"/"||worker?.scriptURL!==window.location.origin+"/sw.js")throw new Error("Unrecognized registration");
    if(!await registration.unregister())throw new Error("Registration was not removed");
    result={...context(),state:"reloading-without-worker"};show();
    window.location.replace("/login/location/check?without-sw=1");
  }catch{
    finish({state:"isolation-failed",message:"ถอด Worker ของชุดทดสอบไม่สำเร็จ ยังยืนยันการทดสอบโดยไม่มี Worker ไม่ได้"});
  }
});
button.addEventListener("click",function(){
  if(button.disabled)return;
  button.disabled=true;isolationButton.disabled=true;
  result={...context(),userActivation:navigator.userActivation?.isActive??"unknown",state:"requesting"};show();
  if(!navigator.geolocation){finish({state:"unsupported"});return;}
  try{
    navigator.geolocation.getCurrentPosition(
      function(){finish({state:"success",coordinatesAvailable:true});},
      function(error){finish({state:"error",code:error.code,message:String(error.message||"").slice(0,300)});},
      {maximumAge:0,timeout:10000,enableHighAccuracy:false}
    );
  }catch(error){finish({state:"exception",message:String(error?.message||error).slice(0,300)});}
});
</script></body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store"}});
}
