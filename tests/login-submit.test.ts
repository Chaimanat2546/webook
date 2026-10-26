import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

test("login submit is disabled with progress feedback while its action is pending",async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL("../app/login/page.tsx",import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"login-server-boundary",setup(builder){
    builder.onResolve({filter:/^\.\/actions$/},()=>({path:"fixture-actions",external:true}));
    builder.onResolve({filter:/login-install-prompt$/},()=>({path:"fixture-pwa",external:true}));
  }}]});
  for(const pending of [false,true]){
    const loaded={exports:{} as {default:(props:{searchParams:Promise<Record<string,string>>})=>Promise<ReactNode>}};
    const require=createRequire(import.meta.url);
    new Function("require","module","exports",bundle.outputFiles[0].text)((name:string)=>{
      if(name==="server-only")return {};
      if(name==="next/image")return function FixtureImage({alt}:{alt:string}){return createElement("img",{alt});};
      if(name==="next/link")return function FixtureLink({href,children}:{href:string;children:ReactNode}){return createElement("a",{href},children);};
      if(name==="fixture-actions")return {signIn:async()=>{},requestPasswordReset:async()=>{}};
      if(name==="fixture-pwa")return {LoginInstallPrompt:()=>null};
      if(name==="react-dom")return {...require("react-dom"),useFormStatus:()=>({pending,data:null,method:null,action:null})};
      return require(name);
    },loaded,loaded.exports);
    const html=renderToStaticMarkup(await loaded.exports.default({searchParams:Promise.resolve({})}));
    const submit=html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];assert.ok(submit);
    assert.equal(/\bdisabled=/.test(submit),pending);
    assert.equal(html.includes("กำลังเข้าสู่ระบบ"),pending);
  }
});
