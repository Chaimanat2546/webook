import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

test("history cleanup runs in native Workers runtime with the existing scheduler",async()=>{
  const {Miniflare,convertV4MiniflareOptions}=await import("miniflare");
  const bundled=await build({write:false,bundle:true,format:"esm",platform:"browser",stdin:{resolveDir:process.cwd(),loader:"ts",contents:`
    import worker from './worker.ts';
    export default {async fetch(){
      await worker.scheduled({cron:'* * * * *',scheduledTime:0},{NEXT_PUBLIC_SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'fixture'});
      return new Response('ok');
    }};
  `},plugins:[{name:"open-next-build-fixture",setup(b){b.onResolve({filter:/\.open-next\/worker\.js$/},()=>({path:"built-handler",namespace:"fixture"}));b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export default {fetch:()=>new Response('fixture')}"}));}}]});
  const calls:string[]=[];
  const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:"2026-06-30",compatibilityFlags:["nodejs_compat","global_fetch_strictly_public"],outboundService(request){
    calls.push(new URL(request.url).pathname);
    return Response.json(0);
  }}));
  try{
    const response=await runtime.dispatchFetch("https://runtime.test/run");
    assert.equal(response.status,200);assert.equal(await response.text(),"ok");
    assert.deepEqual(calls.sort(),["/rest/v1/rpc/admin_expire_waiting_bookings","/rest/v1/rpc/login_history_purge"]);
  }finally{await runtime.dispose();}
});
