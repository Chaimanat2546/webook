import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoginLocationRequest } from "../components/auth/login-location-request.ts";
import type { LocationReport } from "../lib/login-history.ts";
const historyId="40000000-0000-4000-8000-000000000001";
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function fixture() {
  let reads=0;
  let success:PositionCallback=()=>{},error:PositionErrorCallback=()=>{},expire=()=>{};
  const reports:LocationReport[]=[],states:string[]=[];
  const geo:Pick<Geolocation,"getCurrentPosition">={getCurrentPosition(ok,fail,options){
    reads++;success=ok;error=fail!;assert.deepEqual(options,{maximumAge:0,timeout:10000,enableHighAccuracy:false});
  }};
  return {geo,reports,states,reads:()=>reads,succeed:()=>success({timestamp:1793008800000,coords:{latitude:0,longitude:0,accuracy:0}} as GeolocationPosition),fail:(code:number)=>error({code} as GeolocationPositionError),expire:()=>expire(),deadline:(callback:()=>void)=>{expire=callback;return()=>{};}};
}
test("location reads only after explicit share and only once despite repeated calls",async()=>{
  const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:s=>f.states.push(s),save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  assert.equal(f.reads(),0);flow.share();flow.share();assert.equal(f.reads(),1);f.succeed();await tick();
  assert.equal(f.reports.length,1);assert.equal(f.reports[0].status,"success");assert.equal(f.states.at(-1),"saved");
});
test("denial, unavailable and timeout become distinct statuses",async()=>{
  for(const [code,status] of [[1,"denied"],[2,"unavailable"],[3,"timeout"]] as const){
    const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
    flow.share();f.fail(code);await tick();assert.equal(f.reports[0].status,status);
  }
});
test("skip and unsupported never read location",async()=>{
  for(const skip of [true,false]){
    const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:skip?f.geo:null,onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
    if(skip)flow.skip();else flow.share();await tick();assert.equal(f.reads(),0);assert.equal(f.reports[0].status,skip?"skipped":"unsupported");
  }
});
test("watchdog finishes waiting and discards a late browser callback",async()=>{
  const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  flow.share();f.expire();await tick();f.succeed();await tick();assert.deepEqual(f.reports,[{historyId,status:"timeout"}]);
});
test("unmount or account switch cancels old callbacks and any inflight save",async()=>{
  const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  flow.share();flow.cancel();f.succeed();await tick();assert.equal(f.reports.length,0);
});
test("failed persistence can retry the identical payload without reading again",async()=>{
  const f=fixture();let attempts=0;
  const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:s=>f.states.push(s),save:async report=>{f.reports.push(report);return ++attempts>1;},deadline:f.deadline});
  flow.share();f.succeed();await tick();assert.equal(f.states.at(-1),"failed");flow.retry();flow.retry();await tick();
  assert.equal(f.states.at(-1),"saved");assert.equal(f.reads(),1);assert.equal(f.reports.length,2);assert.deepEqual(f.reports[0],f.reports[1]);
});
