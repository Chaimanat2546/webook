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
  const isolationButton={disabled:false,addEventListener:()=>{}};
  const result={textContent:""};
  const windowContext={isSecureContext:true,top:null as unknown,matchMedia:()=>({matches:true})};windowContext.top=windowContext;
  runInNewContext(script,{window:windowContext,document:{getElementById:(id:string)=>id==="request"?button:id==="without-worker"?isolationButton:result,permissionsPolicy:{allowsFeature:()=>true}},navigator:{userActivation:{isActive:true},geolocation:{getCurrentPosition:(ok:()=>void,fail:typeof failure)=>{calls++;success=ok;failure=fail;}}}});
  assert.equal(calls,0,"loading a diagnostic must never request location");
  clicked();assert.equal(calls,1);assert.equal(button.disabled,true);
  failure({code:1,message:"User denied Geolocation"});
  const denied=JSON.parse(result.textContent) as Record<string,unknown>;
  assert.equal(denied.code,1);assert.equal(denied.secureContext,true);assert.equal(denied.topLevel,true);assert.equal(denied.geolocationAvailable,true);assert.equal(denied.standalone,true);assert.equal(denied.userActivation,true);assert.equal(denied.policyAllowed,true);assert.equal(button.disabled,false);
  clicked();success();
  const allowed=JSON.parse(result.textContent) as Record<string,unknown>;
  assert.equal(allowed.coordinatesAvailable,true);assert.equal("latitude" in allowed,false);assert.equal("longitude" in allowed,false);
});

interface ProbeRegistration {
  scope:string;
  active:{scriptURL:string} | null;
  unregister:()=>Promise<boolean>;
}

test("probe can distinguish a controlled PWA from a fresh document without a worker",async(t)=>{
  const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;
  t.after(()=>{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;});
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://sxvkhzhqtrpxgzumsswl.supabase.co";
  const html=await GET().text();const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);
  for(const controlled of [true,false]){
    const handlers=new Map<string,()=>void | Promise<void>>();
    const result={textContent:""};let reads=0;
    const windowContext={isSecureContext:true,top:null as unknown,matchMedia:()=>({matches:true})};windowContext.top=windowContext;
    runInNewContext(script,{window:windowContext,document:{getElementById:(id:string)=>id==="result"?result:{disabled:false,addEventListener:(_type:string,handler:()=>void | Promise<void>)=>handlers.set(id,handler)}},navigator:{serviceWorker:{controller:controlled?{}:null},userActivation:{isActive:true},geolocation:{getCurrentPosition:(_ok:unknown,fail:(error:{code:number;message:string})=>void)=>{reads++;fail({code:1,message:"User denied Geolocation"});}}}});
    assert.equal(JSON.parse(result.textContent).serviceWorkerControlled,controlled);
    assert.equal(reads,0);
    await handlers.get("request")?.();
    const report=JSON.parse(result.textContent) as Record<string,unknown>;
    assert.equal(reads,1);assert.equal(report.code,1);assert.equal(report.serviceWorkerControlled,controlled);
    assert.equal("latitude" in report,false);assert.equal("longitude" in report,false);
  }
});

test("worker isolation is explicit, removes only the app registration and never reads coordinates",async(t)=>{
  const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;
  t.after(()=>{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;});
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://sxvkhzhqtrpxgzumsswl.supabase.co";
  const html=await GET().text();const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);
  for(const mode of ["owned","other-script","other-scope","missing","failed","throws"]){
    const handlers=new Map<string,()=>void | Promise<void>>();
    const navigations:string[]=[];const result={textContent:""};let removals=0,reads=0,lookups=0;
    const registration:ProbeRegistration={scope:mode==="other-scope"?"https://probe.test/other/":"https://probe.test/",active:{scriptURL:mode==="other-script"?"https://probe.test/other.js":"https://probe.test/sw.js"},unregister:async()=>{removals++;if(mode==="throws")throw Error("registration failed");return mode!=="failed";}};
    const windowContext={isSecureContext:true,top:null as unknown,matchMedia:()=>({matches:true}),location:{origin:"https://probe.test",replace:(url:string)=>navigations.push(url)}};windowContext.top=windowContext;
    runInNewContext(script,{window:windowContext,document:{getElementById:(id:string)=>id==="result"?result:{disabled:false,addEventListener:(_type:string,handler:()=>void | Promise<void>)=>handlers.set(id,handler)}},navigator:{serviceWorker:{controller:{},getRegistration:async()=>{lookups++;return mode==="missing"?undefined:registration;}},geolocation:{getCurrentPosition:()=>{reads++;}}}});
    assert.equal(lookups,0);assert.equal(removals,0);assert.equal(reads,0);
    const isolate=handlers.get("without-worker");assert.ok(isolate,"isolation click handler missing");
    await isolate();
    assert.equal(lookups,1);assert.equal(reads,0);
    assert.equal(removals,["owned","failed","throws"].includes(mode)?1:0);
    if(mode==="owned")assert.deepEqual(navigations,["/login/location/check?without-sw=1"]);
    else {assert.deepEqual(navigations,[]);assert.equal(JSON.parse(result.textContent).state,"isolation-failed");}
  }
});
