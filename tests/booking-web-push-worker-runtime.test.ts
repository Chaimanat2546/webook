import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

test("native Workers Push fetch sends successfully and rejects redirects without following them", async () => {
  const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
  const bundled = await build({
    write: false, bundle: true, format: "esm", platform: "browser",
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
      import { sendBookingPush } from './server/notifications/web-push.ts';
      export default { async fetch(request) {
        const vapid = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
        const device = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
        const key = await crypto.subtle.exportKey('jwk',vapid.privateKey);
        const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
        const config = {publicKey:b64(await crypto.subtle.exportKey('raw',vapid.publicKey)),privateKey:key.d,subject:'mailto:test@example.invalid'};
        const job = {
          endpoint:'https://updates.push.services.mozilla.com/wpush/v2/'+new URL(request.url).pathname.slice(1),
          keys:{p256dh:b64(await crypto.subtle.exportKey('raw',device.publicKey)),auth:b64(new Uint8Array(16))},
          notificationId:'00000000-0000-4000-8000-000000000001',attempt:1,
        };
        return Response.json(await sendBookingPush(job,config));
      }};
    ` },
  });
  const requests: string[] = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-06-30", compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    outboundService(request) {
      const target = new URL(request.url);
      requests.push(`${target.hostname}${target.pathname}`);
      if (target.pathname.endsWith("/redirect")) {
        return new Response(null, { status: 302, headers: { Location: "https://unapproved.example/private" } });
      }
      return new Response(null, { status: 201 });
    },
  }));
  try {
    const accepted = await runtime.dispatchFetch("https://runtime.test/accepted");
    assert.deepEqual(await accepted.json(), { status: "sent", error: null, retryAt: null });
    const redirected = await runtime.dispatchFetch("https://runtime.test/redirect");
    assert.deepEqual(await redirected.json(), { status: "failed", error: "push_rejected", retryAt: null });
    assert.deepEqual(requests, [
      "updates.push.services.mozilla.com/wpush/v2/accepted",
      "updates.push.services.mozilla.com/wpush/v2/redirect",
    ]);
  } finally { await runtime.dispose(); }
});
