import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactNode, type ReactElement } from "react";

const currentId="40000000-0000-4000-8000-000000000002";
const oldId="40000000-0000-4000-8000-000000000001";
interface PromptProps {historyId:string}
async function load(file:string,historyId=currentId){
  const names:Record<string,string>={
    "next/headers":"fixture-headers",
    "../../lib/supabase/server":"fixture-server",
    "../../lib/supabase/admin":"fixture-admin",
    "../../server/auth/login-history":"fixture-history",
    "../../../server/auth/login-history":"fixture-history",
    "../../../components/auth/login-location-prompt":"fixture-prompt",
  };
  const bundle=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"external-auth-boundaries",setup(builder){
    builder.onResolve({filter:/^fixture-/},args=>({path:args.path,external:true}));
    builder.onResolve({filter:/.*/},args=>names[args.path]?names[args.path]==="fixture-history"?{path:"history",namespace:"test-auth"}:{path:names[args.path],external:true}:undefined);
    builder.onLoad({filter:/.*/,namespace:"test-auth"},()=>({contents:'module.exports = require("fixture-history");',loader:"js"}));
  }}]});
  const fixtures:Record<string,unknown>={
    "fixture-headers":{cookies:async()=>({get:()=>undefined}),headers:async()=>new Headers()},
    "fixture-server":{createSupabaseServerClient:async()=>({auth:{signInWithPassword:async()=>({data:{user:{id:"user"},session:{access_token:"fictional-token"}},error:null})}})},
    "fixture-admin":{createSupabaseAdminClient:()=>null},
    "fixture-history":{createSignInAuditVerifier:()=>{},recordSignedInSession:async()=>({id:historyId}),loginHistorySession:async()=>({actor:{userId:"user"},repository:{current:async()=>({id:historyId,userId:"user",locationStatus:"pending",loggedInAt:new Date().toISOString()})}})},
    "fixture-prompt":{LoginLocationPrompt:()=>null},
  };
  const loaded={exports:{} as Record<string,unknown>};const require=createRequire(import.meta.url);
  new Function("require","module","exports",bundle.outputFiles[0].text)((name:string)=>name in fixtures?fixtures[name]:name==="server-only"?{}:require(name),loaded,loaded.exports);
  return loaded.exports;
}
function redirectedTo(path:string){return (error:unknown)=>error instanceof Error&&"digest" in error&&String(error.digest).split(";")[2]===path;}

test("each successful sign-in navigates to its own history URL instead of reusing a previous prompt",async()=>{
  for(const id of [oldId,currentId]){
    const entry=await load("../app/login/actions.ts",id);
    const form=new FormData();form.set("identifier","fixture@example.invalid");form.set("adminCredential","fictional-password");
    await assert.rejects(()=>(entry.signIn as (form:FormData)=>Promise<void>)(form),redirectedTo(`/login/location?history=${id}`));
  }
});
test("an old prompt URL redirects to the current verified session's history",async()=>{
  const entry=await load("../app/login/location/page.tsx");
  const page=entry.default as (props:{searchParams:Promise<{history?:string}>})=>Promise<unknown>;
  await assert.rejects(()=>page({searchParams:Promise.resolve({history:oldId})}),redirectedTo(`/login/location?history=${currentId}`));
});
test("current prompt is keyed by history so attempts from an earlier sign-in cannot carry over",async()=>{
  const entry=await load("../app/login/location/page.tsx");
  const page=entry.default as (props:{searchParams:Promise<{history?:string}>})=>Promise<ReactElement<{children:ReactElement<PromptProps>}>>;
  const result=await page({searchParams:Promise.resolve({history:currentId})});
  function find(node:ReactNode):ReactElement<PromptProps>|undefined {
    if(!isValidElement(node))return undefined;
    const props=node.props as {historyId?:string;children?:ReactNode};
    if(props.historyId)return node as ReactElement<PromptProps>;
    for(const child of (Array.isArray(props.children) ? props.children : [props.children])){const found=find(child);if(found)return found;}
  }
  const prompt=find(result);assert.ok(prompt);assert.equal(prompt.key,currentId);assert.equal(prompt.props.historyId,currentId);
});
