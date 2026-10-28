import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DateRange } from "react-day-picker";
import type { HistoryParams } from "../lib/login-history-view.ts";

interface PickerProbe {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  invalid?: boolean;
  describedBy?: string;
  loading?: boolean;
  navigate: (href: string) => void;
}

async function historyPicker() {
  const probe:PickerProbe={navigate:()=>{}};
  const built=await build({entryPoints:["components/admin/login-history/history-filters.tsx"],bundle:true,write:false,format:"cjs",platform:"node",packages:"external",plugins:[{name:"open-history-picker",setup(builder){
    builder.onLoad({filter:/[\\/]history-navigation\.tsx$/},()=>({loader:"js",contents:'import probe from "history-picker-probe";export const useHistoryNavigation=()=>({pending:false,navigate:probe.navigate});'}));
    builder.onLoad({filter:/[\\/]thai-date-range-picker\.tsx$/},()=>({loader:"js",contents:`
      import React from 'react';import probe from 'history-picker-probe';
      export function ThaiDateRangePicker(props){Object.assign(probe,props);return React.createElement('section',null,
        props.value?.from ? props.valueSuffix : 'เลือกช่วงวันที่',
        props.renderSelection?.(props.value));}
    `}));
    builder.onResolve({filter:/^history-picker-probe$/},args=>({path:args.path,external:true}));
  }}]});
  const require=createRequire(import.meta.url),loaded={exports:{} as Record<string,unknown>};
  new Function("require","module","exports",built.outputFiles[0].text)((name:string)=>name==="history-picker-probe"?probe:require(name),loaded,loaded.exports);
  const Filter=loaded.exports.HistoryFilters as ComponentType<{params:HistoryParams;dateError?:boolean;disabled?:boolean}>;
  return {probe,render:(params:HistoryParams={},extra={})=>renderToStaticMarkup(createElement(Filter,{params,...extra}))};
}

test("history shares dashboard hour controls and applies dates plus clocks in one navigation",async()=>{
  const f=await historyPicker();let href="";f.probe.navigate=value=>{href=value;};
  const params={q:"Alice",from:"2026-10-28",to:"2026-10-29",timeFrom:"09:00",timeTo:"18:00",status:"denied",sort:"oldest",page:"3"};
  const html=f.render(params);
  assert.match(html,/เวลาเริ่ม/);assert.match(html,/เวลาสิ้นสุด/);
  assert.match(html,/ทุกวัน 09:00–18:00/);
  assert.equal(href,"","opening or rendering does not apply drafts");
  f.probe.onChange?.({from:new Date(2026,9,27),to:new Date(2026,9,28)});
  const url=new URL(href,"https://test.invalid");
  assert.equal(url.searchParams.get("from"),"2026-10-27");
  assert.equal(url.searchParams.get("to"),"2026-10-28");
  assert.equal(url.searchParams.get("timeFrom"),"09:00");
  assert.equal(url.searchParams.get("timeTo"),"18:00");
  assert.equal(url.searchParams.get("q"),"Alice");
  assert.equal(url.searchParams.get("status"),"denied");
  assert.equal(url.searchParams.get("sort"),"oldest");
  assert.equal(url.searchParams.has("page"),false);
});

test("history keeps unfiltered picker empty and describes login time without graph copy",async()=>{
  const f=await historyPicker();
  assert.match(f.render(),/เลือกช่วงวันที่/);assert.equal(f.probe.value,undefined);
  const html=f.render({from:"2026-10-28",to:"2026-10-28",timeFrom:"09:00",timeTo:"18:00"});
  assert.match(html,/เวลาเริ่ม/);assert.match(html,/เวลาเข้าสู่ระบบ/);
  assert.doesNotMatch(html,/กราฟรายชั่วโมง/);
  f.render({from:"2026-02-30",timeFrom:"18:00",timeTo:"09:00"},{dateError:true,disabled:true});
  assert.equal(f.probe.invalid,true);assert.equal(f.probe.describedBy,"history-date-error");
  assert.equal(f.probe.loading,true);
});
