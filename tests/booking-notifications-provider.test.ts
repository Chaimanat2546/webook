import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import type { NotificationFeedPage, BookingNotification } from "../lib/booking-notifications.ts";
import type { NotificationsContextValue } from "../components/admin/notifications/notifications-context.tsx";

const bundled = build({ entryPoints: ["components/admin/notifications/notifications-provider.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "provider-boundaries", setup(builder) {
  for (const pattern of [/notifications\/actions$/, /notifications-context$/, /notifications-sheet$/, /push-device$/]) builder.onResolve({ filter: pattern }, args => ({ path: args.path, external: true }));
} }] });
const stamp = "2026-10-26T08:00:00.123456Z";
function item(n: number): BookingNotification { return { id: "00000000-0000-4000-8000-" + String(n).padStart(12,"0"), bookingId: String(n), propertyId: "100", title: "House", checkIn: "2026-10-27", checkOut: "2026-10-28", status: "waiting", source: "internal", eventType: "booking_created", createdAt: stamp, bookingUpdatedAt: stamp, readAt: null }; }
const a = item(3), b = item(2), c = item(1), fresh = item(4);
function page(items = [a,b], more = true): NotificationFeedPage { return { actorId: "actor", items, total: 3, unreadCount: 3, page: 1, pageSize: 20, asOf: stamp, pushPublicKey: null, nextCursor: more && items.length ? { createdAt: items.at(-1)!.createdAt, id: items.at(-1)!.id } : null, hasNew: false, retained: null, retainedCursor: null }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve=done; }); return {promise,resolve}; }
async function mount() {
  const bundle = await bundled;
  const hooks: unknown[] = []; let cursor = 0;
  const replies: (NotificationFeedPage | Error | Promise<NotificationFeedPage>)[] = [];
  const requests: {url: string; signal: AbortSignal}[] = [];
  let read: Promise<{ok:true}|{ok:false;message:string}> = Promise.resolve({ok:true});
  const readCalls: {input:unknown;actor:unknown}[] = []; const errors: string[] = []; const document = {visibilityState:"visible"};
  const loaded = { exports: {} as { NotificationsProvider: (props: {actorId:string;children:null}) => {props:{value:NotificationsContextValue}} } };
  const require = createRequire(import.meta.url);
  runInNewContext(bundle.outputFiles[0].text, {
    module:loaded,exports:loaded.exports,AbortController,URLSearchParams,
    document,navigator:{onLine:true},
    fetch:async (url:string,options:{signal:AbortSignal})=>{
      requests.push({url,signal:options.signal});
      assert.ok(replies.length,"unexpected request: "+url);
      const reply=await replies.shift(); if(reply instanceof Error) throw reply;
      return {ok:true,status:200,json:async()=>reply};
    },
    require(id:string){
      if(id==="react") return {
        useState(initial:unknown){const index=cursor++;if(!(index in hooks))hooks[index]=initial;return [hooks[index],(value:unknown)=>{hooks[index]=value;}];},
        useRef(initial:unknown){const index=cursor++;if(!(index in hooks))hooks[index]={current:initial};return hooks[index];},
        useCallback(callback:unknown){return callback;},useEffect(){},
      };
      if(id.endsWith("notifications/actions"))return {readNotifications:(input:unknown,actor:unknown)=>{readCalls.push({input:structuredClone(input),actor});return read}};
      if(id.endsWith("notifications-context"))return {NotificationsContext:{Provider:"provider"}};
      if(id.endsWith("notifications-sheet"))return {NotificationsSheet:()=>null};
      if(id.endsWith("push-device"))return {withTimeout:(promise:Promise<unknown>)=>promise};
      if(id==="sonner")return {toast:{error:(message:string)=>errors.push(message)}};
      return require(id);
    },
  });
  function state(){cursor=0;return loaded.exports.NotificationsProvider({actorId:"actor",children:null}).props.value;}
  return {state,replies,requests,readCalls,errors,document,setRead(value:Promise<{ok:true}|{ok:false;message:string}>){read=value;}};
}

test("load more appends unique rows, forwards the exact cursor and stops at the end",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push(page([b,c],false));await h.state().loadMore();
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[a.id,b.id,c.id]);
 assert.deepEqual(JSON.parse(new URL(h.requests[1].url,"http://fixture").searchParams.get("cursor")!),{createdAt:stamp,id:b.id});
 assert.equal(h.state().data!.nextCursor,null);await h.state().loadMore();assert.equal(h.requests.length,2);
});
test("polling announces new items without replacing the loaded feed or its read-all cutoff",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push({...page([fresh,a]),asOf:"2026-10-26T09:00:00Z",hasNew:true,unreadCount:4,retained:[{...a,readAt:null},{...b,readAt:null}]});await h.state().refresh();
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[a.id,b.id]);assert.equal(h.state().data!.asOf,stamp);assert.equal(h.state().data!.hasNew,true);
 assert.equal(h.state().observedAt,"2026-10-26T09:00:00Z");
 h.replies.push(page([fresh,a]));await h.state().acceptNew();
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[fresh.id,a.id]);assert.equal(h.state().data!.hasNew,false);
});
test("load errors retain content and overlapping load-more calls issue only one request",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push(new Error("offline"));await h.state().loadMore();assert.equal(h.state().data!.items.length,2);assert.ok(h.state().loadMoreError);
 const response=deferred<NotificationFeedPage>();h.replies.push(response.promise);
 const first=h.state().loadMore();await h.state().loadMore();assert.equal(h.requests.length,3);
 response.resolve(page([c],false));await first;assert.equal(h.state().data!.items.length,3);assert.equal(h.state().loadMoreError,null);
});
test("changing category aborts an old load and late read actions refresh the latest filter",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 const read=deferred<{ok:true}>();h.setRead(read.promise);const marking=h.state().markRead({before:stamp});
 const response=deferred<NotificationFeedPage>();h.replies.push(response.promise);const loading=h.state().loadMore();
 h.replies.push(page([fresh],false));h.state().setFilter("payment");await new Promise(setImmediate);
 response.resolve(page([c],false));await loading;
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[fresh.id]);assert.equal(h.requests[1].signal.aborted,true);
 h.replies.push({...page([fresh],false),retained:[{...fresh,readAt:stamp}]});read.resolve({ok:true});await marking;
 assert.ok(h.requests.at(-1)!.url.includes("filter=payment"));assert.equal(h.state().filter,"payment");
});
test("polling removes revoked loaded rows without adding unseen new items",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push({...page([fresh],false),hasNew:true,retained:[{...b,readAt:stamp}]});await h.state().refresh();
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[b.id]);assert.equal(h.state().data!.items[0].readAt,stamp);
});

test("polling follows bounded revalidation cursors before reconciling loaded rows",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push({...page(),retained:[a],retainedCursor:{createdAt:a.createdAt,id:a.id}});
 h.replies.push({...page(),retained:[b]});await h.state().refresh();
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[a.id,b.id]);
 assert.ok(new URL(h.requests[2].url,"http://fixture").searchParams.has("windowCursor"));
});

test("late commits inside the loaded range announce new items without prepending",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push({...page(),hasNew:false,retained:[a,b,c]});await h.state().refresh();
 assert.equal(h.state().data!.hasNew,true);
 assert.deepEqual(Array.from(h.state().data!.items,i=>i.id),[a.id,b.id]);
});

test("an exhausted empty feed announces an older transaction that commits after its cutoff",async()=>{
 const h=await mount();h.replies.push({...page([],false),total:0});await h.state().refresh();
 h.replies.push({...page([c],false),total:1,hasNew:false,retained:[]});await h.state().refresh();
 assert.equal(h.state().data!.hasNew,true);
 assert.equal(h.state().data!.items.length,0);
});

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const readPage = () => ({...page(),unreadCount:0,retained:[{...a,readAt:stamp},{...b,readAt:stamp}]});
test("opening reads every notification through the fresh server cutoff after acknowledgement",async()=>{
 const h=await mount();const read=deferred<{ok:true}>();h.setRead(read.promise);h.replies.push(page());
 const close=h.state().beginInboxSession();await flush();
 assert.equal(h.readCalls.length,1);assert.deepEqual(h.readCalls[0].input,{before:stamp});
 assert.equal(h.readCalls[0].actor,"actor");assert.equal(h.state().data!.unreadCount,3);
 h.replies.push(readPage());read.resolve({ok:true});await flush();
 assert.equal(h.state().data!.unreadCount,0);close();
});
test("closing before the latest snapshot finishes does not mark anything read",async()=>{
 const h=await mount();const response=deferred<NotificationFeedPage>();h.replies.push(response.promise);
 const close=h.state().beginInboxSession();close();response.resolve(page());await flush();assert.equal(h.readCalls.length,0);
});
test("background loading and polling never mark read without an inbox session",async()=>{
 const h=await mount();h.replies.push(page());await h.state().refresh();
 h.replies.push({...page([fresh]),hasNew:true,retained:[a,b]});await h.state().refresh();assert.equal(h.readCalls.length,0);
});
test("new arrivals wait for explicit acceptance; changing filter does not read them",async()=>{
 const h=await mount();h.replies.push(page(),readPage());const close=h.state().beginInboxSession();await flush();
 h.replies.push({...page([fresh]),hasNew:true,retained:[a,b]});await h.state().refresh();assert.equal(h.readCalls.length,1);
 const newer={...page([fresh],false),total:1,asOf:"2026-10-26T09:00:00.654321Z",unreadCount:1};
 h.replies.push(newer);h.state().setFilter("payment");await flush();assert.equal(h.readCalls.length,1);assert.equal(h.state().data!.hasNew,true);
 h.replies.push(newer,{...newer,unreadCount:0,retained:[{...fresh,readAt:newer.asOf}]});await h.state().acceptNew();
 assert.equal(h.readCalls.length,2);assert.deepEqual(h.readCalls[1].input,{before:newer.asOf});assert.equal(h.state().data!.hasNew,false);close();
});
test("failed loading can retry, while failed reading leaves the unread count intact",async()=>{
 const h=await mount();h.replies.push(new Error("offline"));const close=h.state().beginInboxSession();await flush();assert.equal(h.readCalls.length,0);
 h.setRead(Promise.resolve({ok:false,message:"failed"}));h.replies.push(page());await h.state().refresh();
 assert.equal(h.readCalls.length,1);assert.equal(h.state().data!.unreadCount,3);assert.equal(h.errors.length,1);close();
});

test("closing animation and immediate reopening read only the new viewing session",async()=>{
 const h=await mount();const old=deferred<NotificationFeedPage>();h.replies.push(old.promise);const close=h.state().beginInboxSession();
 h.state().setOpen(false);close();h.replies.push(page(),readPage());const closeNew=h.state().beginInboxSession();await flush();
 old.resolve(page());await flush();assert.equal(h.readCalls.length,1);closeNew();
});

test("closing a resized Sheet cannot cancel the new full-page viewing session",async()=>{
 const h=await mount();const old=deferred<NotificationFeedPage>();h.replies.push(old.promise);
 const closeSheet=h.state().beginInboxSession("sheet");
 h.replies.push(page(),readPage());const closePage=h.state().beginInboxSession("page");
 h.state().setOpen(false);closeSheet();await flush();old.resolve(page());await flush();
 assert.equal(h.readCalls.length,1);assert.equal(h.state().data!.unreadCount,0);closePage();
});
