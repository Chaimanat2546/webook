import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

test("scheduled cleanup and booking maintenance run independently and never leak upstream errors",async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL("../worker.ts",import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"built-handler",setup(b){b.onResolve({filter:/\.open-next\/worker\.js$/},()=>({path:"fixture-handler",external:true}));}}]});
  for(const failure of ["booking","purge",null]){
    const calls:string[]=[],logs:unknown[]=[];
    const loaded={exports:{} as {default:{scheduled:(controller:unknown,env:unknown)=>Promise<void>}}};
    const require=createRequire(import.meta.url);
    new Function("require","module","exports","console",bundle.outputFiles[0].text)((name:string)=>name==="fixture-handler"?{default:{fetch:()=>new Response()}}:name==="@supabase/supabase-js"?{createClient:(url:string,key:string)=>createClient(url,key,{global:{fetch:async input=>{
      const path=new URL(String(input)).pathname.split("/").at(-1)!;calls.push(path);
      const fail=failure==="booking"?path==="admin_expire_waiting_bookings":failure==="purge"&&path==="login_history_purge";
      return fail?Response.json({code:"XX000",message:"private credential detail"},{status:500}):Response.json(path==="login_history_purge"?1000:0);
    }}})}:name==="server-only"?{}:require(name),loaded,loaded.exports,{warn:(...args:unknown[])=>logs.push(args),error:(...args:unknown[])=>logs.push(args)});
    const run=()=>loaded.exports.default.scheduled({cron:"* * * * *",scheduledTime:0},{NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"test-key"});
    if(failure)await assert.rejects(run,/maintenance_failed/);else await run();
    assert.ok(calls.includes("admin_expire_waiting_bookings"));assert.ok(calls.includes("login_history_purge"));
    assert.ok(!JSON.stringify(logs).includes("private credential"));
    if(failure!=="purge")assert.match(JSON.stringify(logs),/backlog/);
  }
});
