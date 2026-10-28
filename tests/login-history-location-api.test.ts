import assert from "node:assert/strict";
import { test } from "node:test";
import { handleLoginLocation } from "../server/http/login-history.ts";
import { LoginHistoryError } from "../lib/login-history.ts";
import { createLoginHistoryRepository } from "../server/repositories/login-history.ts";
import { createClient } from "@supabase/supabase-js";
import { createLoginLocationRequest } from "../components/auth/login-location-request.ts";
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

test("storage capture-time rejection is diagnosed separately from invalid input without logging private values",async t=>{
  const events:unknown[][]=[];
  t.mock.method(Date,"now",()=>Date.parse("2026-10-26T10:00:00.500Z"));
  t.mock.method(console,"warn",(...values:unknown[])=>{events.push(values);});
  const client=createClient("https://example.supabase.co","test",{global:{fetch:async()=>Response.json({code:"22023",message:"invalid_capture_time",details:"PRIVATE-DATABASE-DETAILS"},{status:400})}});
  const repository=createLoginHistoryRepository(client);
  const response=await handleLoginLocation(request(JSON.stringify({historyId,status:"success",latitude:0,longitude:0,accuracy:1,capturedAt:"2026-10-26T10:00:00Z"})),async()=>({actor,repository}));
  assert.equal(response.status,400);
  assert.deepEqual(events,[["login_location_rejected",{stage:"storage",reason:"invalid_capture_time",captureAgeBand:"under_5s"}]]);
  const invalid=await handleLoginLocation(request(JSON.stringify({historyId,status:"success",latitude:91,longitude:0,accuracy:1,capturedAt:"2026-10-26T10:00:00Z"})),async()=>({actor,repository}));
  assert.equal(invalid.status,400);
  assert.deepEqual(events[1],["login_location_rejected",{stage:"request",reason:"invalid_report"}]);
  assert.ok(!JSON.stringify(events).includes("PRIVATE"));
  assert.ok(!JSON.stringify(events).includes(historyId));
  assert.deepEqual(await response.json(),{error:"ไม่สามารถบันทึกตำแหน่งได้"});
});

test("an explicit coordinate result reaches the authenticated location RPC without dropping precision or zero values", {timeout:3000}, async () => {
  // Synthetic browser positions: this verifies the app boundary, not device GPS.
  for(const coords of [{latitude:0,longitude:0,accuracy:0},{latitude:13.1234567,longitude:100.7654321,accuracy:7.5}]){
    let reads=0,writes=0,requests=0;
    const states:string[]=[];
    let finished=()=>{};
    const completion=new Promise<void>(resolve=>{finished=resolve;});
    const capturedAt="2026-10-26T10:00:01.000Z";
    const client=createClient("https://example.supabase.co","test",{global:{fetch:async(input,init)=>{
      assert.equal(new URL(String(input)).pathname,"/rest/v1/rpc/login_history_attach");
      const payload=JSON.parse(String(init?.body)) as Record<string,unknown>;
      assert.deepEqual(payload,{
        p_user:actor.userId,p_session:actor.sessionId,p_history:historyId,p_status:"success",
        p_latitude:coords.latitude,p_longitude:coords.longitude,p_accuracy:coords.accuracy,p_captured_at:capturedAt,
      });
      writes++;
      return Response.json({id:historyId,user_id:actor.userId,logged_in_at:"2026-10-26T10:00:00Z",location_status:"success",latitude:coords.latitude,longitude:coords.longitude,accuracy_m:coords.accuracy,location_captured_at:capturedAt});
    }}});
    const repository=createLoginHistoryRepository(client);
    const flow=createLoginLocationRequest({
      historyId,
      geolocation:{getCurrentPosition(success){reads++;success({timestamp:Date.parse(capturedAt),coords} as GeolocationPosition);}},
      onState(state){states.push(state);if(state==="saved"||state==="failed")finished();},
      save:async report=>{
        requests++;
        const response=await handleLoginLocation(request(JSON.stringify(report)),async()=>({actor,repository}));
        assert.equal(response.status,200);
        assert.deepEqual(await response.json(),{saved:true});
        return response.ok;
      },
    });
    assert.equal(reads,0);assert.equal(requests,0);assert.equal(writes,0);
    flow.share();await completion;
    assert.deepEqual(states,["reading","saving","saved"]);
    assert.equal(reads,1);assert.equal(requests,1);assert.equal(writes,1);
    flow.cancel();
  }
});
