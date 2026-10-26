import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { GET } from "../app/login/location/check/route.ts";

test("direct geolocation diagnostic is available only in Staging and requests only on an explicit click",async(t)=>{
  const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;
  t.after(()=>{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;});
  for(const url of [undefined,"https://rqizfiayvcbozlzuvbok.supabase.co","https://other.supabase.co"]){
    if(url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=url;
    assert.equal(GET().status,404);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://sxvkhzhqtrpxgzumsswl.supabase.co";
  const response=GET();assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/no-store/);
  const html=await response.text();const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);
  let clicked:()=>void=()=>assert.fail("click handler missing");
  let failure:(error:{code:number;message:string})=>void=()=>assert.fail("error callback missing");
  let success:()=>void=()=>assert.fail("success callback missing");
  let calls=0;
  const button={disabled:false,addEventListener:(type:string,callback:()=>void)=>{assert.equal(type,"click");clicked=callback;}};
  const result={textContent:""};
  const windowContext={isSecureContext:true,top:null as unknown,matchMedia:()=>({matches:true})};windowContext.top=windowContext;
  runInNewContext(script,{window:windowContext,document:{getElementById:(id:string)=>id==="request"?button:result,permissionsPolicy:{allowsFeature:()=>true}},navigator:{userActivation:{isActive:true},geolocation:{getCurrentPosition:(ok:()=>void,fail:typeof failure)=>{calls++;success=ok;failure=fail;}}}});
  assert.equal(calls,0,"loading a diagnostic must never request location");
  clicked();assert.equal(calls,1);assert.equal(button.disabled,true);
  failure({code:1,message:"User denied Geolocation"});
  const denied=JSON.parse(result.textContent) as Record<string,unknown>;
  assert.equal(denied.code,1);assert.equal(denied.secureContext,true);assert.equal(denied.topLevel,true);assert.equal(denied.geolocationAvailable,true);assert.equal(denied.standalone,true);assert.equal(denied.userActivation,true);assert.equal(denied.policyAllowed,true);assert.equal(button.disabled,false);
  clicked();success();
  const allowed=JSON.parse(result.textContent) as Record<string,unknown>;
  assert.equal(allowed.coordinatesAvailable,true);assert.equal("latitude" in allowed,false);assert.equal("longitude" in allowed,false);
});
