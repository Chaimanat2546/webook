import assert from "node:assert/strict";
import { test } from "node:test";
import { describeComparisonPeriod, comparePeriodConditions, assessPeriodComparison, matchComparisonTime } from "../lib/website-analytics-comparison-policy.ts";
import { pairWebsitePeriods, websitePeriodChange, websitePeriodSeries, websitePeriodRows, websiteMultiPeriodPoints, type WebsitePeriodSeries } from "../lib/website-analytics-comparison.ts";
import { emptyMetrics, type AnalyticsDateRange, type WebsiteSummary } from "../lib/website-analytics.ts";

const kinds = ["S24", "ST", "R24", "RT"] as const;
function range(kind: typeof kinds[number], previous = false): AnalyticsDateRange {
  return { from: kind.startsWith("S") ? previous ? "2026-10-10" : "2026-10-14" : previous ? "2026-10-08" : "2026-10-12", to: previous ? "2026-10-10" : "2026-10-14", ...(kind.endsWith("T") ? { timeFrom: "09:00", timeTo: "18:00" } : {}) };
}
function series(value: AnalyticsDateRange, granularity: "hour" | "day", total = 20): WebsitePeriodSeries {
  const description = describeComparisonPeriod(value, granularity);
  return { range: value, granularity, total, availableDays: description.dayCount, expectedDays: description.dayCount, coverageComplete: true, status: "complete", daily: [], asOf: "2026-10-17T00:00:00Z", ...(granularity === "hour" ? { durationMinutes: description.requestedHours * 60 } : {}) };
}
test("all sixteen ordered selection pairs share one structural policy", async t => {
  for (const a of kinds) for (const b of kinds) await t.test(`${a}/${b}`, () => {
    const ga = a.startsWith("S") ? "hour" : "day", gb = b.startsWith("S") ? "hour" : "day";
    const reasons = [ ...(ga !== gb ? ["granularity_mismatch", "day_count_mismatch"] : []), ...(a.endsWith("T") !== b.endsWith("T") ? ["time_window_mismatch"] : []) ];
    const result = comparePeriodConditions(describeComparisonPeriod(range(a), ga), describeComparisonPeriod(range(b, true), gb));
    assert.deepEqual(result, { layout: ga !== gb ? "separate" : "overlay", reasons });
    assert.equal(assessPeriodComparison(series(range(a), ga), series(range(b,true), gb)).canCompare, !reasons.length);
  });
});
test("equal duration at different clock times cannot produce a percentage", () => {
  const a = series({ from:"2026-10-14",to:"2026-10-14",timeFrom:"09:00",timeTo:"12:00" },"hour");
  const b = series({ from:"2026-10-13",to:"2026-10-13",timeFrom:"18:00",timeTo:"21:00" },"hour",10);
  assert.equal(assessPeriodComparison(a,b).layout,"overlay");
  assert.deepEqual(websitePeriodChange(a,b),{kind:"unavailable"});
  assert.deepEqual(assessPeriodComparison({...a,granularity:"day"},{...b,granularity:"day"}).reasons,["time_window_mismatch"]);
});
test("full-day normalization, unequal days and source granularity stay explicit", () => {
  const a=describeComparisonPeriod(range("R24"),"day");
  assert.equal(a.requestedHours,72);
  assert.deepEqual(comparePeriodConditions(a,describeComparisonPeriod({...range("R24"),timeFrom:"00:00",timeTo:"24:00"},"day")).reasons,[]);
  assert.deepEqual(comparePeriodConditions(a,describeComparisonPeriod({from:"2026-10-01",to:"2026-10-07"},"day")).reasons,["day_count_mismatch"]);
  assert.equal(comparePeriodConditions(describeComparisonPeriod(range("S24"),"day"),describeComparisonPeriod(range("S24"),"hour")).layout,"separate");
});
test("missing sites, failures, partial retention and elapsed status suppress percentage", () => {
  const a=series(range("RT"),"day"),b=series(range("RT",true),"day");
  assert.deepEqual(assessPeriodComparison(a,b,{currentSelected:true,previousSelected:false}).reasons,["site_not_shared"]);
  assert.deepEqual(assessPeriodComparison({...a,total:null,status:"unavailable",coverageComplete:false},b).reasons,["load_failed"]);
  assert.deepEqual(assessPeriodComparison({...a,status:"partial",coverageComplete:false},b).reasons,["coverage_incomplete"]);
  assert.deepEqual(assessPeriodComparison({...a,status:"ongoing",asOf:"2026-10-12T01:00:00Z"},b).reasons,["not_started"]);
  assert.deepEqual(assessPeriodComparison({...a,status:"ongoing",asOf:"2026-10-12T03:00:00Z"},b).reasons,["ongoing"]);
  assert.equal(assessPeriodComparison(a,b).canCompare,true);
});
test("matching copies clocks only, preserving both comparison dates and minimum date", () => {
  assert.deepEqual(matchComparisonTime(range("RT"),{from:"2026-10-01",to:"2026-10-10"}),{from:"2026-10-01",to:"2026-10-10",timeFrom:"09:00",timeTo:"18:00"});
  assert.deepEqual(matchComparisonTime(range("S24"),{from:"2026-10-01",to:"2026-10-10"}),{from:"2026-10-01",to:"2026-10-10",timeFrom:"00:00",timeTo:"24:00"});
  assert.deepEqual(matchComparisonTime(range("RT"),{from:"1900-01-01",to:"1900-01-01"}),{from:"1900-01-01",to:"1900-01-01",timeFrom:"09:00",timeTo:"18:00"});
});
test("same and overlapping dates stay comparable and zero baselines stay finite", () => {
  const a=series(range("RT"),"day");
  assert.deepEqual(websitePeriodChange(a,a),{kind:"percentage",difference:0,percentage:0});
  assert.equal(assessPeriodComparison(a,{...a,range:{...a.range,from:"2026-10-11",to:"2026-10-13"}}).canCompare,true);
  assert.deepEqual(websitePeriodChange({...a,total:0},{...a,total:0}),{kind:"unchanged",difference:0});
  assert.deepEqual(websitePeriodChange(a,{...a,total:0}),{kind:"zero_baseline",difference:20});
});
test("explicit source unit wins over single date and clocks, including unavailable sources", () => {
  const legacy = websitePeriodSeries(undefined, { from:"2026-10-01",to:"2026-10-01",timeFrom:"00:00",timeTo:"24:00" }, "2026-10-01T03:00:00Z", "page_views", "day");
  assert.equal(legacy.granularity,"day");
  assert.equal(legacy.expectedDays,1);
  const hourly = websitePeriodSeries(undefined, range("S24"), "2026-10-17T00:00:00Z", "page_views", "hour");
  assert.equal(hourly.granularity,"hour");
  assert.equal(hourly.expectedDays,24);
});
test("selected end, future window and microsecond retention use the same assessment", () => {
  const selected={from:"2026-10-14",to:"2026-10-14",timeFrom:"09:00",timeTo:"12:00"};
  const site: WebsiteSummary={key:"a",displayName:"A",origin:"https://a.test",status:"complete",totals:emptyMetrics(),daily:[{date:selected.from,...emptyMetrics()}],coverage:{data_available_from:"2026-10-01T00:00:00Z",range_complete:true,rows_complete:true}};
  const read=(asOf:string,input=site)=>websitePeriodSeries(input,selected,asOf,"page_views","day");
  const ended=read("2026-10-14T05:00:00Z");
  assert.equal(ended.status,"complete");
  assert.deepEqual(assessPeriodComparison(read("2026-10-14T04:00:00Z"),ended).reasons,["ongoing"]);
  assert.ok(assessPeriodComparison(read("2026-10-14T01:00:00Z"),ended).reasons.includes("not_started"));
  const retained=read("2026-10-14T05:00:00Z",{...site,status:"partial",coverage:{...site.coverage!,data_available_from:"2026-10-14T02:00:00.000001Z",range_complete:false}});
  assert.equal(retained.daily[0].value,null);
  assert.deepEqual(assessPeriodComparison(retained,ended).reasons,["coverage_incomplete"]);
});
test("seven requested days survive failed first site and retain null beyond a shorter period", () => {
  const current={from:"2026-10-12",to:"2026-10-14",timeFrom:"09:00",timeTo:"18:00"};
  const prior={from:"2026-10-01",to:"2026-10-07",timeFrom:"09:00",timeTo:"18:00"};
  const healthy=(selected:AnalyticsDateRange):WebsiteSummary=>({key:"b",displayName:"B",origin:"https://b.test",status:"complete",coverage:{data_available_from:"2026-09-01T00:00:00Z",range_complete:true,rows_complete:true},totals:emptyMetrics(),daily:Array.from({length:describeComparisonPeriod(selected,"day").dayCount},(_,i)=>({date:new Date(Date.parse(selected.from)+i*86400000).toISOString().slice(0,10),...emptyMetrics()}))});
  const failed:WebsiteSummary={key:"a",displayName:"A",origin:"https://a.test",status:"unavailable",totals:null,coverage:null};
  const rows=websitePeriodRows([failed,healthy(current)],current,{range:prior,granularity:"day",sites:[failed,healthy(prior)]},"2026-10-17T00:00:00Z","page_views","day");
  const points=websiteMultiPeriodPoints(rows);
  assert.equal(points.length,7);assert.equal(points[0].values.a.current,null);assert.equal(points[0].values.b.current,0);
  assert.equal(points[6].date,"");assert.equal(points[6].previousDate,"2026-10-07");assert.equal(points[6].values.b.current,null);assert.equal(points[6].values.b.previous,0);
});

test("hourly overlays align Thai hours and retain gaps, zeroes and dates", () => {
  const hourly=(date:string,start:number,end:number):WebsitePeriodSeries=>({...series({from:date,to:date,timeFrom:String(start).padStart(2,"0")+":00",timeTo:String(end).padStart(2,"0")+":00"},"hour"),daily:Array.from({length:end-start},(_,i)=>({date:date+"T"+String(start+i).padStart(2,"0")+":00:00+07:00",value:i}))});
  const morning=hourly("2026-10-15",9,12),evening=hourly("2026-10-14",18,21);
  const points=pairWebsitePeriods(morning,evening);
  assert.equal(points.length,12);
  assert.deepEqual(points[0],{hour:"09:00",date:morning.daily[0].date,previousDate:"",current:0,previous:null});
  assert.deepEqual(points[5],{hour:"14:00",date:"",previousDate:"",current:null,previous:null});
  assert.deepEqual(points[9],{hour:"18:00",date:"",previousDate:evening.daily[0].date,current:null,previous:0});
  const reverse=pairWebsitePeriods(evening,morning); assert.equal(reverse[0].hour,"09:00"); assert.equal(reverse[0].previous,0);
  const overlap=pairWebsitePeriods(morning,hourly("2026-10-14",10,13));
  assert.equal(overlap.length,4);assert.equal(overlap[1].current,1);assert.equal(overlap[1].previous,0);
  const full=pairWebsitePeriods(hourly("2026-10-15",0,24),evening);assert.equal(full.length,24);assert.equal(full[23].hour,"23:00");
  const failed=(value:WebsitePeriodSeries)=>({...value,total:null,status:"unavailable" as const,daily:value.daily.map(point=>({...point,value:null}))});
  const row={key:"failed",displayName:"Failed",currentSelected:true,previousSelected:true,current:failed(morning),previous:failed(evening)};
  const multi=websiteMultiPeriodPoints([row,{...row,key:"healthy",current:morning,previous:evening}]);
  assert.equal(multi.length,12);assert.equal(multi[5].hour,"14:00");assert.equal(multi[0].values.failed.current,null);assert.equal(multi[0].values.healthy.current,0);
});
