import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoginLocationRequest, matchesLoginLocationSession } from "../components/auth/login-location-request.ts";
import type { LocationReport } from "../lib/login-history.ts";
const historyId="40000000-0000-4000-8000-000000000001";
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test("a replacement session for the same account cancels the old location context",()=>{
  const userId="10000000-0000-4000-8000-000000000001";
  const token=(id:string)=>`e30.${Buffer.from(JSON.stringify({sub:userId,session_id:id})).toString("base64url")}.fake`;
  assert.equal(matchesLoginLocationSession({user:{id:userId},access_token:token(historyId)},userId,historyId),true);
  assert.equal(matchesLoginLocationSession({user:{id:userId},access_token:token("30000000-0000-4000-8000-000000000002")},userId,historyId),false);
  assert.equal(matchesLoginLocationSession(null,userId,historyId),false);
  assert.equal(matchesLoginLocationSession({user:{id:"another"},access_token:token(historyId)},userId,historyId),false);
  assert.equal(matchesLoginLocationSession({user:{id:userId},access_token:"malformed"},userId,historyId),false);
});
function fixture() {
  let reads=0;
  let success:PositionCallback=()=>{},error:PositionErrorCallback=()=>{},expire=()=>{};
  const reports:LocationReport[]=[],states:string[]=[];
  const geo:Pick<Geolocation,"getCurrentPosition">={getCurrentPosition(ok,fail,options){
    reads++;success=ok;error=fail!;assert.deepEqual(options,{maximumAge:0,timeout:10000,enableHighAccuracy:false});
  }};
  return {geo,reports,states,reads:()=>reads,succeed:()=>success({timestamp:1793008800000,coords:{latitude:0,longitude:0,accuracy:0}} as GeolocationPosition),fail:(code:number)=>error({code} as GeolocationPositionError),expire:()=>expire(),deadline:(callback:()=>void)=>{expire=callback;return()=>{};}};
}

test("skip continues before a pending save and unmount cannot abort that dispatched save",async()=>{
  const f=fixture(); let continued=0; let signal:AbortSignal|undefined;
  let finish:(value:boolean)=>void=()=>{};
  const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:()=>{},onContinue:()=>{continued++;},save:async(report,requestSignal)=>{
    f.reports.push(report);signal=requestSignal;return new Promise<boolean>(resolve=>{finish=resolve;});
  },deadline:f.deadline});
  flow.skip(); assert.equal(continued,1);assert.equal(f.reads(),0);assert.equal(f.reports[0].status,"skipped");
  flow.cancel(); assert.equal(signal?.aborted,false); finish(false); await tick(); assert.equal(continued,1);
});

test("all classified permission outcomes continue even when persistence fails",async()=>{
  for(const code of [0,1,2,3,4]){
    const f=fixture();let continued=0;
    const flow=createLoginLocationRequest({historyId,geolocation:code===4?null:f.geo,onContinue:()=>{continued++;},onState:()=>{},save:async()=>false,deadline:f.deadline});
    flow.share();if(code===0)f.succeed();else if(code!==4)f.fail(code);
    assert.equal(continued,1);await tick();assert.equal(continued,1);
  }
});
test("location reads only after explicit share and only once despite repeated calls",async()=>{
  const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:s=>f.states.push(s),save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  assert.equal(f.reads(),0);flow.share();flow.share();assert.equal(f.reads(),1);f.succeed();await tick();
  assert.equal(f.reports.length,1);assert.equal(f.reports[0].status,"success");assert.equal(f.states.at(-1),"saved");
});
test("denial, unavailable and timeout become distinct statuses",async()=>{
  for(const [code,status] of [[1,"denied"],[2,"unavailable"],[3,"timeout"]] as const){
    const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:f.geo,onState:state=>f.states.push(state),save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
    flow.share();f.fail(code);await tick();assert.equal(f.reports[0].status,status);
    assert.equal(f.states.at(-1),status,"persisting a location failure must not announce coordinate success or auto-continue");
  }
});
test("skip and unsupported never read location",async()=>{
  for(const skip of [true,false]){
    const f=fixture();const flow=createLoginLocationRequest({historyId,geolocation:skip?f.geo:null,onState:state=>f.states.push(state),save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
    if(skip)flow.skip();else flow.share();await tick();assert.equal(f.reads(),0);assert.equal(f.reports[0].status,skip?"skipped":"unsupported");
    assert.equal(f.states.at(-1),skip?"saved":"unsupported");
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

test("an iOS-style old first fix waits for a newer fix without submitting the rejected timestamp",async()=>{
  const f=fixture();let next:PositionCallback=()=>{};const cleared:number[]=[];let watches=0;
  const minimum=Date.parse("2026-10-26T10:00:00Z");
  const geo={...f.geo,watchPosition(success:PositionCallback){watches++;next=success;return 42;},clearWatch(id:number){cleared.push(id);}};
  const position=(timestamp:number)=>({timestamp,coords:{latitude:0,longitude:0,accuracy:1}} as GeolocationPosition);
  const reports:LocationReport[]=[];
  let first:PositionCallback=()=>{};
  const freshFlow=createLoginLocationRequest({historyId,geolocation:{...geo,getCurrentPosition(ok:PositionCallback){first=ok;}},minimumCapturedAt:minimum,onState:()=>{},save:async report=>{reports.push(report);return true;},deadline:f.deadline});
  freshFlow.share();first(position(minimum-30000));await tick();
  assert.equal(watches,1);assert.equal(reports.length,0);
  next(position(minimum-10000));assert.equal(watches,1);assert.equal(reports.length,0);
  next(position(minimum+2000));await tick();
  assert.deepEqual(reports,[{historyId,status:"success",latitude:0,longitude:0,accuracy:1,capturedAt:"2026-10-26T10:00:02.000Z"}]);
  assert.deepEqual(cleared,[42]);freshFlow.cancel();assert.deepEqual(cleared,[42]);
});

test("a synchronous fresh watch callback is saved once and its returned watch id is still cleared",async()=>{
  const f=fixture();const minimum=1793008801000;const cleared:number[]=[];
  const flow=createLoginLocationRequest({historyId,minimumCapturedAt:minimum,geolocation:{getCurrentPosition(ok){ok({timestamp:minimum-10000} as GeolocationPosition);},watchPosition(ok){ok({timestamp:minimum,coords:{latitude:0,longitude:0,accuracy:0}} as GeolocationPosition);return 9;},clearWatch(id){cleared.push(id);}},onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  flow.share();await tick();assert.equal(f.reports.length,1);assert.equal(f.reports[0].status,"success");assert.deepEqual(cleared,[9]);flow.cancel();
});

test("an old first fix without a cancellable watch never sends stale coordinates",async()=>{
  const f=fixture();
  const flow=createLoginLocationRequest({historyId,minimumCapturedAt:1793008801000,geolocation:f.geo,onState:s=>f.states.push(s),save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
  flow.share();f.succeed();await tick();assert.deepEqual(f.reports,[{historyId,status:"unavailable"}]);assert.equal(f.reads(),1);
});

test("cancelling or timing out the fresh-fix wait clears its watch and discards later fixes",async()=>{
  for(const expire of [false,true]){
    const f=fixture();let first:PositionCallback=()=>{},next:PositionCallback=()=>{};const cleared:number[]=[];
    const minimum=1793008801000;
    const flow=createLoginLocationRequest({historyId,minimumCapturedAt:minimum,geolocation:{getCurrentPosition(ok){first=ok;},watchPosition(ok){next=ok;return 7;},clearWatch(id){cleared.push(id);}},onState:()=>{},save:async report=>{f.reports.push(report);return true;},deadline:f.deadline});
    flow.share();first({timestamp:minimum-30000,coords:{latitude:0,longitude:0,accuracy:1}} as GeolocationPosition);
    if(expire)f.expire();else flow.cancel();
    next({timestamp:minimum+5000,coords:{latitude:0,longitude:0,accuracy:1}} as GeolocationPosition);await tick();
    assert.deepEqual(cleared,[7]);assert.deepEqual(f.reports,expire?[{historyId,status:"timeout"}]:[]);
  }
});
