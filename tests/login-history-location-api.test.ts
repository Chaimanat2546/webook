import assert from "node:assert/strict";
import { test } from "node:test";
import { handleLoginLocation } from "../server/http/login-history.ts";
import { LoginHistoryError } from "../lib/login-history.ts";
import { createLoginHistoryRepository } from "../server/repositories/login-history.ts";
import { createClient } from "@supabase/supabase-js";
const historyId="40000000-0000-4000-8000-000000000001";
const actor={userId:"10000000-0000-4000-8000-000000000001",sessionId:"30000000-0000-4000-8000-000000000001"};
function request(body: string,origin="https://webook.test") {return new Request("https://webook.test/api/login-history/location",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body});}
test("Next loopback canonicalization accepts the actual local Host but never a foreign host or port",async()=>{
  for(const [target,origin,host,status] of [
    ["http://localhost:5001","http://127.0.0.1:5001","127.0.0.1:5001",401],
    ["http://localhost:5001","http://127.0.0.1:5002","127.0.0.1:5002",403],
    ["https://webook.test","https://evil.test","evil.test",403],
  ] as const){
    const req=new Request(`${target}/api/login-history/location`,{method:"POST",headers:{Origin:origin,Host:host,"Content-Type":"application/json"},body:JSON.stringify({historyId,status:"skipped"})});
    assert.equal((await handleLoginLocation(req,async()=>{throw new LoginHistoryError(401);})).status,status);
  }
});
test("location API rejects cross origin, oversized and malformed input before auth", async () => {
  let authCalls=0;
  const auth=async()=>{authCalls++;throw new LoginHistoryError(401);};
  for (const [req,status] of [[request("{}","https://evil.test"),403],[request("x".repeat(2049)),400],[request("{"),400],[request(JSON.stringify({historyId,status:"pending"})),400],[request(JSON.stringify({historyId,status:"denied",latitude:0})),400]] as const) {
    const response=await handleLoginLocation(req,auth);assert.equal(response.status,status);assert.match(response.headers.get("cache-control")!,/no-store/);
  }
  assert.equal(authCalls,0);
});
test("location API maps auth, ownership, conflict and storage errors without leaking DB details", async () => {
  for (const status of [401,404,409,503] as const) {
    const response=await handleLoginLocation(request(JSON.stringify({historyId,status:"skipped"})),async()=>{throw new LoginHistoryError(status);});
    assert.equal(response.status,status);assert.ok(!JSON.stringify(await response.json()).includes("session"));
  }
});
test("location API ignores client identity and writes only the authenticated actor", async () => {
  const client=createClient("https://example.supabase.co","test",{global:{fetch:async(_input,init)=>{
    const payload=JSON.parse(String(init?.body));assert.equal(payload.p_user,actor.userId);assert.equal(payload.p_session,actor.sessionId);assert.equal(payload.p_history,historyId);
    return Response.json({id:historyId,user_id:actor.userId,logged_in_at:"2026-10-26T10:00:00Z",location_status:"skipped"});
  }}});
  const response=await handleLoginLocation(request(JSON.stringify({historyId,status:"skipped"})),async()=>({actor,repository:createLoginHistoryRepository(client)}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{saved:true});
  assert.equal(response.headers.get("access-control-allow-origin"),null);
});
