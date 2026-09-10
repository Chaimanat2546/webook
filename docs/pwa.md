# WeBooks PWA

The display brand is **WeBooks** and the npm package is `webooks`. Existing
`webook-*` infrastructure names, storage keys, source-module paths, and internal
identifiers remain unchanged for compatibility; this is a display-name update,
not a deployment or database migration. The offline cache version is bumped so
new installations receive the updated offline-page name.

WeBooks can be installed from a supporting browser and opened as a standalone app.
The app keeps the existing authentication and feature permissions. PWA icons use
the user-supplied WeBooks app artwork. The login page and sidebar use the separate
user-supplied transparent website logo.

## Installation

- Android Chrome / desktop Chrome or Edge: open WeBooks over HTTPS, sign in,
  choose **ติดตั้งแอป** at the bottom of the sidebar, then **ติดตั้งแอป WeBooks**.
  The install button appears when the browser provides an installation prompt.
  Browser menu installation is also supported when offered by the browser.
- iPhone / iPad: open the site in Safari, use Share → Add to Home Screen,
  enable Open as Web App if offered, then Add. The sidebar dialog includes Thai
  instructions; Safari does not expose the Chromium installation prompt.
- The installation entry is hidden in standalone mode and after the current
  page receives an `appinstalled` event. A dismissed prompt is consumed; the
  dialog falls back to browser menu instructions until a fresh event is offered.

## Offline behavior and privacy

The service worker precaches only the public assets listed in `public/sw.js`:
the standalone offline HTML, its retry script, and app icons. These assets need
to have been downloaded during an earlier online visit before offline launch works.

Page navigations use the network without storing their responses. A network
failure returns the Thai offline page at the original requested URL. **ลองใหม่**
reloads that same URL. HTTP errors such as 401/403/404/500 remain server responses.

Admin HTML, customer records, public quotation pages, RSC responses, API requests,
uploads, Server Actions, and third-party requests are never stored in this service
worker's cache. Existing authentication remains authoritative. Viewing live data
and saving work require an internet connection. There is no offline mutation queue
or automatic retry of saves; in-app navigation and forms keep their existing error
handling. The fallback handles full page navigation/launch, not failed RSC requests.

## Files and lifecycle

- `app/manifest.ts`: relative, same-origin app identity, scope, start URL, theme,
  standalone display and standard icons.
- `app/layout.tsx`: Apple home-screen metadata, theme color, and root PWA provider.
- `components/pwa/`: worker registration, install event capture, and reusable
  sidebar installation dialog.
- `public/pwa/icon-192.png` and `public/pwa/icon-512.png`: app icons derived from
  the user-supplied artwork, preserving transparency and original proportions.
  The 180px Apple icon also preserves the supplied transparency, without added
  backing colors. No maskable variant is advertised: the approved artwork is
  not designed for arbitrary cropping. Device launchers may still apply their
  own background or presentation; physical-device appearance must be verified.
- `public/brand/webooks-logo-transparent.png`: user-supplied transparent website
  logo and taglines, used on the login page and admin sidebar. Its distinct URL
  avoids reusing the previous opaque logo from an image cache.
- `public/sw.js`: public offline cache, network-only navigation fallback, and
  cleanup restricted to caches beginning `webook-offline-`.
- `next.config.ts`: worker JavaScript MIME type, root scope, and `no-store`
  headers; public PWA assets revalidate over the network.

Registration runs only in a production build on a secure context (HTTPS or
localhost). `npm run dev` does not register the worker. Test development on a
different port/profile from a previously installed production build, or remove
that localhost worker in browser DevTools before development.

Bump `CACHE_NAME` in `public/sw.js` whenever any precached asset changes. An update
waits until the previous worker no longer controls any open tabs/windows, including
the installed app. It does not call `skipWaiting` or force a page reload, so it
does not interrupt editing. Reopen the app after closing all its windows to use
an available update. No new dependencies or database changes are required.

## Verification

Automated worker tests execute the shipped script inside a VM with simulated
browser Cache/Fetch APIs. They check offline fallback, privacy boundaries,
network pass-through, HTTP errors, offline assets, and conservative updates.

```sh
node --test tests/pwa-worker.test.ts
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --port 3137
```

In a browser at localhost:3137 (or an HTTPS deployment):

1. Verify `/manifest.webmanifest` and its icons load without authentication.
2. Open `/login` online and inspect Application → Service Workers; `/sw.js`
   should activate with root scope. Its response must have `Cache-Control: no-store`.
3. Inspect Cache Storage: the WeBooks offline cache contains public PWA assets only.
4. Set the browser context offline and reload a page: the offline message and
   retry button should render. Restore networking and retry the same page.
5. With an authorized session, open the install dialog on desktop and in the
   mobile sidebar. Test prompt acceptance/dismissal and Safari instructions.
6. Install on a physical Android/iOS device to confirm native home-screen icons
   and standalone launch. Browser simulation cannot confirm the native OS UI.

Deployment uses the existing approved environment workflow. Adding PWA support
does not itself deploy the application.
