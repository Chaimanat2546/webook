import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("match in the comparison popup edits a draft anchored to its selected end without navigation",async()=>{
  interface Probe { buttons:{children?:unknown;onClick?:()=>void;disabled?:boolean}[]; selected?:{from:Date;to:Date}; draft:{from:Date;to:Date} }
  const probe:Probe={buttons:[],draft:{from:new Date("2026-10-04T00:00:00"),to:new Date("2026-10-10T00:00:00")}};
  const built=await build({entryPoints:["components/admin/dashboard/website-analytics/website-date-range-picker.tsx"],bundle:true,write:false,format:"cjs",platform:"node",packages:"external",plugins:[{name:"probe",setup(b){
    b.onLoad({filter:/[\\/]report-date-range-picker\.tsx$/},()=>({loader:"js",contents:'import React from "react";import probe from "match-probe";export function ReportDateRangePicker(props){return React.createElement("section",null,props.renderSelection(probe.draft,range=>{probe.selected=range}));}export const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;'}));
    b.onLoad({filter:/[\\/]ui[\\/]button\.tsx$/},()=>({loader:"js",contents:'import React from "react";import probe from "match-probe";export function Button(props){probe.buttons.push(props);return React.createElement("button",{disabled:props.disabled},props.children);}'}));
    b.onResolve({filter:/^match-probe$/},a=>({path:a.path,external:true}));
  }}]});
  const require=createRequire(import.meta.url),loaded={exports:{} as Record<string,unknown>};
  new Function("require","module","exports",built.outputFiles[0].text)((name:string)=>name==="match-probe"?probe:require(name),loaded,loaded.exports);
  const Picker=loaded.exports.WebsiteDateRangePicker as ComponentType<Record<string,unknown>>;
  let changes=0;
  const render=(extra:Record<string,unknown>={})=>{probe.buttons=[];return renderToStaticMarkup(createElement(Picker,{month:"2026-10",range:{from:"2026-10-01",to:"2026-10-05"},matchPrimary:{from:"2026-10-14",to:"2026-10-16",timeFrom:"09:00",timeTo:"18:00"},onChange:()=>{changes++},...extra}));};
  assert.match(render(),/ใช้จำนวนวันและเวลาตามช่วงหลัก/);
  probe.buttons.find(b=>b.children==="ใช้จำนวนวันและเวลาตามช่วงหลัก")?.onClick?.();
  assert.equal(probe.selected?.from.getDate(),8);
  assert.equal(probe.selected?.to.getDate(),10,"uses draft end rather than committed end");
  assert.equal(changes,0,"waits for Apply");
  probe.draft={from:new Date("1900-01-01T00:00:00"),to:new Date("1900-01-01T00:00:00")};
  assert.match(render(),/ช่วงที่ปรับจะเริ่มก่อน/);
  assert.equal(probe.buttons.find(b=>b.children==="ใช้จำนวนวันและเวลาตามช่วงหลัก")?.disabled,true);
  render({matchDisabledReason:"เลือกช่วงหลักจากปฏิทินก่อนปรับเงื่อนไข"});
  assert.equal(probe.buttons.find(b=>b.children==="ใช้จำนวนวันและเวลาตามช่วงหลัก")?.disabled,true);
});
