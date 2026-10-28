import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

test("login form disables credentials, password toggle and submit together while pending",async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL("../components/auth/login-form.tsx",import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"login-server-boundary",setup(builder){
    builder.onResolve({filter:/app\/login\/actions$/},()=>({path:"fixture-actions",external:true}));
  }}]});
  for(const pending of [false,true]){
    const loaded={exports:{} as {LoginForm:()=>ReactNode}};
    const require=createRequire(import.meta.url);
    new Function("require","module","exports",bundle.outputFiles[0].text)((name:string)=>{
      if(name==="next/link")return function FixtureLink({href,children}:{href:string;children:ReactNode}){return createElement("a",{href},children);};
      if(name==="fixture-actions")return {signInAction:async()=>{}};
      if(name==="react")return {...require("react"),useActionState:()=>[{status:"idle",identifier:""},()=>{},pending]};
      return require(name);
    },loaded,loaded.exports);
    const html=renderToStaticMarkup(createElement(loaded.exports.LoginForm));
    const controls=[...html.matchAll(/<(?:input|button)\b[^>]*>/g)].map(match=>match[0]);
    assert.equal(controls.length,4);
    for(const control of controls)assert.equal(/\bdisabled=/.test(control),pending);
    assert.equal(html.includes("กำลังเข้าสู่ระบบ"),pending);
    assert.match(html,/autoComplete="username"/);assert.match(html,/autoComplete="current-password"/);
    assert.match(html,/aria-label="แสดงรหัสผ่าน"/);
  }
});
