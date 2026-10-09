import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

async function workspace(allowed:boolean) {
  const calls:string[]=[];
  const context={repository:{async house(id:string){calls.push(`house:${id}`);return {id:'listing-100',property_id:'100',title:'บ้านทดสอบ'};}},calendarRepository:{async list(ids:string[]){calls.push(`sources:${ids.join(',')}`);return [];}}};
  const output=await build({entryPoints:['components/admin/houses/calendar-sources-workspace.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{
    name:'authenticated-boundary',setup(builder){
      builder.onResolve({filter:/server\/auth\/calendar-sources$/},()=>({path:'auth',namespace:'test'}));
      builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"import {context,allowed,calls} from '__test_context__'; export async function requireCalendarSourcesAdmin(){calls.push('authorize');if(!allowed)throw new Error('forbidden');return context;}"}));
      builder.onResolve({filter:/^__test_context__$/},()=>({path:'__test_context__',external:true}));
      builder.onResolve({filter:/app\/admin\/houses\/\[propertyId\]\/calendar-sources\/actions$/},()=>({path:'ui-actions',namespace:'actions'}));
      builder.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:"export async function saveCalendarSourceAction(){throw new Error('not used by static render');} export async function refreshCalendarSourcesAction(){throw new Error('not used by static render');}"}));
    },
  }]});
  const loaded={exports:{} as Record<string,unknown>},nodeRequire=createRequire(import.meta.url);
  new Function('require','module','exports',output.outputFiles[0].text)((id:string)=>id==='server-only'?{}:id==='__test_context__'?{context,allowed,calls}:nodeRequire(id),loaded,loaded.exports);
  return {calls,render:loaded.exports.CalendarSourcesWorkspace as (props:Record<string,unknown>)=>Promise<ReactNode>};
}

test('calendar settings use the house section navigation and plain-language form',async()=>{
  const {render,calls}=await workspace(true);
  const tree=await render({propertyId:'100',returnTo:null,sections:[{key:'details',label:'ข้อมูลบ้าน'},{key:'calendar',label:'เชื่อมปฏิทินภายนอก'}]});
  const html=renderToStaticMarkup(tree);
  assert.deepEqual(calls,['authorize','house:100','sources:listing-100']);
  assert.match(html,/<a\b(?=[^>]*href="\/admin\/houses\/100\?section=calendar")(?=[^>]*aria-current="page")[^>]*>/);
  for(const text of ['เชื่อมปฏิทินภายนอก','เพิ่มปฏิทิน Airbnb','ลิงก์ปฏิทิน Airbnb','อัปเดตข้อมูล'])assert.ok(html.includes(text),text);
  for(const text of ['เพิ่ม Airbnb iCal URL','ตรวจสอบการซิงก์','cache'])assert.ok(!html.includes(text),text);
  assert.match(html,/id="calendar-url"[^>]*type="password"|type="password"[^>]*id="calendar-url"/);
  assert.match(html,/<input\b(?=[^>]*id="calendar-url")(?=[^>]*autoComplete="new-password")[^>]*>/);
});

test('calendar settings reject unauthorized access before house or source reads',async()=>{
  const {render,calls}=await workspace(false);
  await assert.rejects(render({propertyId:'100',returnTo:null,sections:[]}),/forbidden/);
  assert.deepEqual(calls,['authorize']);
});

test('booking-only calendar managers have a house-list entry on desktop and mobile',async()=>{
  const output=await build({entryPoints:['components/admin/houses/house-list.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external'});
  const loaded={exports:{} as Record<string,unknown>};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {createElement,isValidElement,Children}=await import('react');
  const List=loaded.exports.HouseList as import('react').ComponentType<Record<string,unknown>>;
  const props={canManageAccommodation:false,canManagePrices:false,canViewPrices:false,canManageCalendars:true,returnTo:'/admin/houses?page=2',houses:[{property_id:'100',title:'บ้านทดสอบ',is_active:true,bedrooms:2,bathrooms:2,location_zone:null}]};
  const html=renderToStaticMarkup(createElement(List,props));
  assert.ok(!html.includes('เชื่อมปฏิทินภายนอก'),'closed menus must not add visible links or buttons to the original list');
  function links(input:typeof props) {
    const found:string[]=[];
    function visit(node:ReactNode,insideMenu=false) {
      Children.forEach(node,child=>{
        if(!isValidElement<Record<string,unknown>>(child))return;
        if(typeof child.type==='function'&&/^House(Mobile)?ActionsMenu$/.test(child.type.name)) {
          visit((child.type as (values:Record<string,unknown>)=>ReactNode)(child.props),true);
          return;
        }
        if(insideMenu&&typeof child.props.href==='string'&&child.props.href.includes('section=calendar'))found.push(child.props.href);
        visit(child.props.children as ReactNode,insideMenu);
      });
    }
    visit((List as unknown as (values:Record<string,unknown>)=>ReactNode)(input));
    return found;
  }
  assert.deepEqual(links(props),[
    '/admin/houses/100?section=calendar&returnTo=%2Fadmin%2Fhouses%3Fpage%3D2',
    '/admin/houses/100?section=calendar&returnTo=%2Fadmin%2Fhouses%3Fpage%3D2',
  ]);
  const denied=renderToStaticMarkup(createElement(List,{...props,canManageCalendars:false}));
  assert.ok(!denied.includes('เชื่อมปฏิทินภายนอก'));
  assert.deepEqual(links({...props,canManageCalendars:false}),[]);
});
