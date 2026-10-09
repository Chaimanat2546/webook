import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCalendarSourceInput } from '../server/services/calendar-sources.ts';
test('source form accepts an Airbnb secret only and trims the label',()=>{
  assert.deepEqual(parseCalendarSourceInput({label:' Main ',url:'https://www.airbnb.com/calendar/ical/123.ics?t=synthetic'}),
    {label:'Main',url:'https://www.airbnb.com/calendar/ical/123.ics?t=synthetic',enabled:true,sourceId:null});
});
test('source replacement can preserve a secret but requires a valid ID',()=>{
  assert.equal(parseCalendarSourceInput({sourceId:'00000000-0000-4000-8000-000000000001',label:'Main',url:'',enabled:false}).url,null);
  for(const input of [{label:'Main',url:''},{label:' ',url:'secret'},{sourceId:'invalid',label:'Main',url:''},{label:'Main',url:'https://evil.test'},{label:'Main',enabled:'true',url:'secret'}])assert.throws(()=>parseCalendarSourceInput(input));
});
