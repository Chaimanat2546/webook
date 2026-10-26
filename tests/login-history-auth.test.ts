import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyLoginActor, loginRequestIp, recordSignedInSession, createSignInAuditVerifier } from "../server/auth/login-history.ts";
const userId="10000000-0000-4000-8000-000000000001",sessionId="30000000-0000-4000-8000-000000000001";
test("verified identity and claims must come from the same token", async () => {
  const auth={getUser:async (token:string)=>{assert.equal(token,"token");return {data:{user:{id:userId}},error:null};},getClaims:async (token:string)=>{assert.equal(token,"token");return {data:{claims:{sub:userId,session_id:sessionId}},error:null};}};
  assert.deepEqual(await verifyLoginActor(auth,"token"),{userId,sessionId});
  await assert.rejects(()=>verifyLoginActor({...auth,getClaims:async()=>({data:null,error:{message:"unverified"}})},"token"));
  await assert.rejects(()=>verifyLoginActor({...auth,getUser:async()=>({data:{user:{id:sessionId}},error:null})},"token"));
});
test("IP requires trusted Cloudflare ingress and valid IPv4 or IPv6", () => {
  const headers=new Headers({"cf-connecting-ip":"2001:db8::1","x-forwarded-for":"192.0.2.1"});
  assert.equal(loginRequestIp(headers,true),"2001:db8::1");
  assert.equal(loginRequestIp(headers,false),null);
  headers.delete("cf-connecting-ip"); assert.equal(loginRequestIp(headers,true),null);
  headers.set("cf-connecting-ip","127.0.0.1, 192.0.2.1"); assert.equal(loginRequestIp(headers,true),null);
});
test("post-sign-in audit deadline aborts stalled verification before any persistence",async(t)=>{
  let aborted=false;
  let requests=0;
  t.mock.method(console,"warn",()=>{});
  t.mock.method(globalThis,"fetch",async()=>{requests++;throw new Error("unexpected persistence");});
  const begin=performance.now();
  const result=await recordSignedInSession(signal=>({
    getClaims:async()=>new Promise(resolve=>signal.addEventListener("abort",()=>{aborted=true;resolve({data:null,error:new Error("aborted")});},{once:true})),
    getUser:async()=>new Promise(resolve=>signal.addEventListener("abort",()=>resolve({data:{user:null},error:new Error("aborted")}),{once:true})),
  }),"token",userId,new Headers(),20);
  // Persistence would need a service client; no such configuration exists in
  // this test. A late verifier must never reach that stage after the abort.
  assert.equal(result,null);assert.equal(aborted,true);
  assert.ok(performance.now()-begin<500);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(requests,0);
});
test("real audit auth client attaches the deadline to a stalled provider fetch",async(t)=>{
  const keys=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
  const previous=keys.map(key=>process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture";
  t.after(()=>keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];}));
  let aborted=0;
  t.mock.method(console,"warn",()=>{});
  t.mock.method(globalThis,"fetch",async(_input:unknown,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
    assert.ok(init?.signal);
    init.signal.addEventListener("abort",()=>{aborted++;reject(new DOMException("cancelled","AbortError"));},{once:true});
  }));
  const result=await recordSignedInSession(createSignInAuditVerifier,"invalid-test-token",userId,new Headers(),20);
  assert.equal(result,null);assert.ok(aborted>=1);
});
