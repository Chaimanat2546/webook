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
<p>ผลการตรวจสอบบนเครื่องนี้:</p><pre id="result" role="status" aria-live="polite"></pre>
<a href="/">กลับหน้าหลัก</a></main>
<script>
const button=document.getElementById("request");
const output=document.getElementById("result");
function context(){
  let policyAllowed="unknown";
  try{const policy=document.permissionsPolicy||document.featurePolicy;if(policy)policyAllowed=policy.allowsFeature("geolocation");}catch{}
  return {secureContext:!!window.isSecureContext,topLevel:window.top===window,
    standalone:window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true,
    geolocationAvailable:!!navigator.geolocation,policyAllowed};
}
let result={...context(),state:"idle"};
function show(){output.textContent=JSON.stringify(result,null,2);}
function finish(values){result={...result,...values};button.disabled=false;show();}
show();
button.addEventListener("click",function(){
  if(button.disabled)return;
  button.disabled=true;
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
