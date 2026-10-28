import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createClient } from "@supabase/supabase-js";
import { createLoginHistoryRepository } from "../server/repositories/login-history.ts";
import { parseHistoryFilter, type LoginHistoryEntry } from "../lib/login-history.ts";

test("history search uses trusted scope and literal date/page filters at the RPC boundary",async()=>{
  const client=createClient("https://example.supabase.co","test",{global:{fetch:async(input,init)=>{
    assert.equal(new URL(String(input)).pathname,"/rest/v1/rpc/login_history_list");
    assert.deepEqual(JSON.parse(String(init?.body)),{p_actor:"root",p_search:"B",p_from:"2026-10-25T17:00:00.000Z",p_to:"2026-10-26T17:00:00.000Z",p_page:2,p_size:25,p_status:"pending",p_sort:"oldest",p_time_from:0,p_time_to:24});
    return Response.json({entries:[],total:30});
  }}});
  const page=await createLoginHistoryRepository(client).list({kind:"root-admin",userId:"root"},parseHistoryFilter({q:"B",from:"2026-10-26",to:"2026-10-26",page:"2",status:"pending",sort:"oldest"}));
  assert.equal(page.total,30);assert.equal(page.page,2);
});
test("root read scope comes only from an exact uid lookup, never an email match",async()=>{
  for(const role of [1,2,null]){
    const client=createClient("https://example.supabase.co","test",{global:{fetch:async input=>{
      const url=new URL(String(input));assert.equal(url.searchParams.get("uid"),"eq.actor");assert.equal(url.searchParams.has("email"),false);
      return Response.json(role===null?null:{role_id:role});
    }}});
    const scope=await createLoginHistoryRepository(client).scope({userId:"actor",sessionId:"session"});
    assert.equal(scope.kind,role===1?"root-admin":"self");
  }
});

test("history hourly selection reaches the RPC before counting or pagination",async()=>{
  const client=createClient("https://example.supabase.co","test",{global:{fetch:async(_input,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.equal(body.p_time_from,9);assert.equal(body.p_time_to,18);
    assert.equal(body.p_page,2);assert.equal(body.p_status,"denied");
    return Response.json({entries:[],total:30});
  }}});
  const result=await createLoginHistoryRepository(client).list({kind:"root-admin",userId:"root"},parseHistoryFilter({from:"2026-10-28",to:"2026-10-29",timeFrom:"09:00",timeTo:"18:00",page:"2",status:"denied"}));
  assert.equal(result.total,30);
});
test("history renders escaped data, zero coordinates, accuracy and missing location states",async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL("../components/admin/login-history/history-list.tsx",import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",packages:"external"});
  const loaded={exports:{} as {HistoryList?:(props:{entries:LoginHistoryEntry[]})=>React.ReactNode}};
  new Function("require","module","exports",bundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const base:LoginHistoryEntry={id:"history",userId:"user",loggedInAt:"2026-10-26T10:00:00Z",ipAddress:"192.0.2.1",os:"Linux",browser:"Chrome",deviceType:"desktop",locationStatus:"success",latitude:0,longitude:0,accuracy:5,capturedAt:null,receivedAt:null,displayName:"<script>private</script>",username:null,email:null};
  const markup=renderToStaticMarkup(createElement(loaded.exports.HistoryList!,{entries:[base,{...base,id:"denied",locationStatus:"denied",latitude:null,longitude:null,accuracy:null}]}));
  assert.match(markup,/0\.00000/);assert.match(markup,/5 เมตร/);assert.match(markup,/ไม่อนุญาต/);assert.ok(!markup.includes("<script>private</script>"));assert.ok(!markup.includes("session_id"));

});
