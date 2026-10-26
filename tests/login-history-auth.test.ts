import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyLoginActor, loginRequestIp } from "../server/auth/login-history.ts";
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
