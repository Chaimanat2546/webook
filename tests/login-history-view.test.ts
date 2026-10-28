import assert from "node:assert/strict";
import { test } from "node:test";
import { loadHistoryView } from "../server/services/login-history-view.ts";
import { historyHref, historyRangeLabel, hasHistoryCriteria } from "../lib/login-history-view.ts";
import type { LoginHistoryRepository } from "../server/repositories/login-history.ts";

const actor={userId:"actor",sessionId:"session"};

test("history navigation retains clocks and invalid time ranges never query records",async()=>{
  const params={q:"Alice",from:"2026-10-28",to:"2026-10-29",timeFrom:"09:00",timeTo:"18:00",status:"success",sort:"oldest"};
  const url=new URL(historyHref(params,{page:"2"}),"https://test.invalid");
  assert.equal(url.searchParams.get("timeFrom"),"09:00");
  assert.equal(url.searchParams.get("timeTo"),"18:00");
  const f=repository();
  const view=await loadHistoryView(f.repo,actor,{...params,timeFrom:"19:00"});
  assert.equal(view.state,"invalid-date");assert.equal(f.reads(),0);
  assert.equal(view.params.timeFrom,"19:00");
  assert.equal(hasHistoryCriteria({timeFrom:"09:00"}),true);
});
function repository(root=true) {
  let reads=0;
  const repo={scope:async()=>({kind:root?"root-admin":"self",userId:actor.userId}),list:async()=>{reads++;return {entries:[],total:0,page:1,pageSize:25};}} as Pick<LoginHistoryRepository,"scope"|"list">;
  return {repo,reads:()=>reads};
}
test("non-root history entry is forbidden before query validation or records",async()=>{
  const f=repository(false);const view=await loadHistoryView(f.repo,actor,{from:"bad"});
  assert.equal(view.state,"forbidden");assert.equal(f.reads(),0);
});
test("invalid dates preserve correction criteria without issuing a data query",async()=>{
  const f=repository();const view=await loadHistoryView(f.repo,actor,{from:"2026-02-30",q:"Alice",status:"denied",sort:"oldest"});
  assert.equal(view.state,"invalid-date");assert.equal(view.params.q,"Alice");assert.equal(view.params.from,"2026-02-30");assert.equal(f.reads(),0);
});
test("duplicate query rejection retains the visible search instead of silently broadening recovery",async()=>{
  const f=repository();const view=await loadHistoryView(f.repo,actor,{q:["Alice","Bob"],status:"denied"});
  assert.equal(view.state,"invalid-filter");assert.equal(f.reads(),0);assert.equal(view.params.q,"Alice");
  assert.equal(historyHref(view.params,{sort:"oldest"}),"/admin/login-history?q=Alice&status=denied&sort=oldest");
});
test("load failure and filtered empty stay distinct and retain the selected criteria",async()=>{
  const f=repository();
  assert.equal((await loadHistoryView(f.repo,actor,{})).state,"default-empty");
  assert.equal((await loadHistoryView(f.repo,actor,{sort:"oldest"})).state,"default-empty");
  assert.equal((await loadHistoryView(f.repo,actor,{status:"pending"})).state,"filtered-empty");
  f.repo.list=async()=>{throw Error("private database text");};
  const view=await loadHistoryView(f.repo,actor,{q:"Alice",status:"pending"});
  assert.equal(view.state,"load-error");assert.equal(view.params.q,"Alice");assert.doesNotMatch(JSON.stringify(view),/private/);
});
test("pagination and retry keep status, order, dates and search while range text handles zero",()=>{
  assert.equal(historyHref({q:"Alice",from:"2026-10-28",status:"pending",sort:"oldest",pageSize:"25"},{page:"2"}),"/admin/login-history?q=Alice&from=2026-10-28&status=pending&sort=oldest&page=2&pageSize=25");
  assert.equal(historyRangeLabel(1,25,80,25),"แสดง 1–25 จาก 80 รายการ");
  assert.equal(historyRangeLabel(4,25,80,5),"แสดง 76–80 จาก 80 รายการ");
  assert.equal(historyRangeLabel(1,25,0,0),"แสดง 0 รายการ");
  assert.equal(hasHistoryCriteria({sort:"oldest"}),false);
});
