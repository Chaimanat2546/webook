import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

test('native Workers fetch imports a feed and never follows redirects', {skip:process.env.ICAL_WORKER_INTEGRATION!=='1'}, async () => {
  const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
  const bundled = await build({write:false,bundle:true,format:'esm',platform:'browser',
    stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
      import {fetchIcal} from './server/calendar/fetch-ical.ts';
      export default {async fetch(request) {
        const mode=new URL(request.url).pathname.slice(1);
        try {return Response.json({body:await fetchIcal('https://www.airbnb.com/calendar/ical/123.ics?mode='+mode)});}
        catch(error){return Response.json({error:error.message});}
      }};
    `},plugins:[{name:'test-server-only',setup(b){
      b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'test-only'}));
      b.onLoad({filter:/.*/,namespace:'test-only'},()=>({contents:'export {};'}));
    }}]});
  let followed = false;
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules:true, script:bundled.outputFiles[0].text,
    compatibilityDate:'2026-06-30',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],
    outboundService(request) {
      const target=new URL(request.url);
      if(target.hostname!=='www.airbnb.com'){followed=true;return new Response('unexpected');}
      if(target.searchParams.get('mode')==='redirect')return new Response(null,{status:302,headers:{location:'https://unapproved.example/private'}});
      return new Response('BEGIN:VCALENDAR\\r\\nEND:VCALENDAR');
    },
  }));
  try {
    assert.deepEqual(await (await runtime.dispatchFetch('https://runtime.test/feed')).json(),{body:'BEGIN:VCALENDAR\\r\\nEND:VCALENDAR'});
    assert.deepEqual(await (await runtime.dispatchFetch('https://runtime.test/redirect')).json(),{error:'calendar_http_error'});
    assert.equal(followed,false);
  } finally {await runtime.dispose();}
});

test('iCal integration modules execute in local Workers runtime', {skip:process.env.ICAL_WORKER_INTEGRATION!=='1'},async()=>{
  // Miniflare is supplied by the pinned Wrangler dependency, not a new install.
  const {Miniflare}=await import('miniflare');
  const bundled=await build({write:false,bundle:true,format:'esm',platform:'browser',
    stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
      import {parseIcal} from './server/calendar/parse-ical.ts';
      import {fetchIcal} from './server/calendar/fetch-ical.ts';
      import {encryptSourceUrl,decryptSourceUrl} from './server/calendar/source-secret.ts';
      export default {async fetch(){
        const url='https://www.airbnb.com/calendar/ical/123.ics?t=synthetic';
        const encrypted=await encryptSourceUrl(url);
        const restored=await decryptSourceUrl(encrypted);
        const feed='BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nBEGIN:VEVENT\\r\\nUID:synthetic\\r\\nDTSTART;VALUE=DATE:20261015\\r\\nDTEND;VALUE=DATE:20261018\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR';
        const events=parseIcal(await fetchIcal(restored,async()=>new Response(feed)));
        let rejected=false;
        try {parseIcal(feed.replace('END:VEVENT','END:VTODO'));}catch{rejected=true;}
        return Response.json({events,restored:restored===url,secretHidden:!encrypted.includes(url),rejected});
      }};
    `},plugins:[{name:'test-server-only',setup(b){
      b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'test-only'}));
      b.onLoad({filter:/.*/,namespace:'test-only'},()=>({contents:'export {};'}));
    }}]});
  const key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const runtime=new Miniflare({telemetry:{enabled:false},workers:[{config:{name:'ical-runtime-test',type:'worker',
    compatibilityDate:'2026-06-30',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],
    manifest:{mainModule:'worker.js',modules:{'worker.js':{type:'esm',contents:bundled.outputFiles[0].text}}},
    env:{ICAL_SOURCE_ENCRYPTION_KEY:{type:'text',value:key}}}}]});
  try{
    const response=await runtime.dispatchFetch('https://runtime.test/');
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{events:[{uid:'synthetic',status:'active',start:'2026-10-15',endExclusive:'2026-10-18'}],restored:true,secretHidden:true,rejected:true});
  }finally{await runtime.dispose();}
});
