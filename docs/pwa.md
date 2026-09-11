# WeBooks PWA

For the video-guided acceptance checklist and updated browser support matrix,
see [PWA checklist](pwa-checklist.md). It tracks planned work and verification;
the behavior documented below describes the current implementation.

The display brand is **WeBooks** and the npm package is `webooks`. Existing
`webook-*` infrastructure names, storage keys, source-module paths, and internal
identifiers remain unchanged for compatibility; this is a display-name update,
not a deployment or database migration. Workbox revisions change automatically
when the public offline assets change.

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
- Other supporting browsers on iOS/iPadOS 16.4+ can also expose Home Screen
  installation through their Share menu; Safari is the recommended route, not
  the only possible browser.
- Safari on macOS Sonoma 14+: use File/Share → Add to Dock.
- Firefox on Windows: use its address-bar web apps button (143+, or 150+ for
  Microsoft Store installations). This is a browser-specific installation flow.
- The installation entry is hidden in standalone mode and after the current
  page receives an `appinstalled` event. A dismissed prompt is consumed; the
  dialog falls back to browser menu instructions until a fresh event is offered.

## Offline behavior and privacy

The Workbox service worker precaches only the public assets allowlisted in `scripts/build-pwa.mjs`:
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

The admin shell shows an accessible black toast with light text at the top when
the browser reports loss of connectivity. It uses a stable toast ID, has no timeout,
and cannot be dismissed by a close button or swipe. Shared admin toasts use the
dark appearance regardless of the page theme and expand rather than overlap.
Returning online removes only the offline toast without refreshing the
page or replaying writes; that signal does not prove the server is reachable.
Shared App Router error boundaries offer a read retry without exposing raw error
details, and an admin loading fallback provides feedback while routes load.

Quotation save/delete requests catch missing responses locally. A missing response
is treated as an unknown outcome: the server may have committed the operation.
The editor retains its current state and tells the user to check the list before
sending the operation again. This handling is limited to those editor paths;
it is not a guarantee that every form across the system retains state on failure.

## Login install invitation

The normal login screen automatically displays a dismissible dark install banner
above the form after hydration. Password-reset mode does not show it. Standalone
mode and the browser's appinstalled signal suppress it. “ไว้ทีหลัง” dismisses it
for the current mounted login screen; it does not block signing in or save account
information in browser storage.

When beforeinstallprompt is available, one click calls the existing installation
handler directly. Browser confirmation is still required. Otherwise the button
opens shared manual installation instructions. Acceptance or dismissal of the
native prompt hides this invitation; failures offer the instructions. Browsers
may not report an installation made previously in a separate browser tab.

The local browser fixture verifies initial visibility, the unavailable-to-ready
transition, and exactly one prompt call on click with the invitation then hidden.
This uses a simulated browser install event, not an actual OS installation.

The sidebar installation button also calls the browser prompt directly when a
pending beforeinstallprompt event is available, without first opening the help
dialog. All browsers providing this capability use the same path; there is no
browser-name allowlist. An event is consumed synchronously before prompting so
rapid repeated clicks cannot reuse it. A fresh event can enable installation
again later. Missing capability falls back to instructions, and prompt errors
show help without claiming installation succeeded. This does not guarantee that
every installable browser will dispatch the event on every visit.

## Sharing saved quotations

The existing share action uses the device share sheet when supported, preserving
the existing saved-document and public-link checks. Cancelling that sheet ends
the action. Unsupported or failed native sharing falls back to clipboard; if
clipboard is unavailable or denied, a dialog displays the selectable existing
URL. Sharing does not create or rotate a public token.

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
- `worker/pwa-sw.js`: Workbox precache and NetworkOnly routes. Only exact public
  asset URLs without query parameters match the asset route.
- `scripts/build-pwa.mjs`: esbuild bundles the runtime; Workbox `injectManifest`
  injects content revisions for exactly five files. `npm run build` runs this
  before Next.js; OpenNext invokes that build script too.
- `public/sw.js`: committed generated artifact, with no external runtime imports.
  Workbox cleans obsolete revisions inside `webook-pwa-precache-v1`; activation
  also removes legacy caches beginning `webook-offline-`, preserving unrelated caches.
- `next.config.ts`: worker JavaScript MIME type, root scope, and `no-store`
  headers; public PWA assets revalidate over the network.

Registration runs only in a production build on a secure context (HTTPS or
localhost). `npm run dev` does not register the worker. Test development on a
different port/profile from a previously installed production build, or remove
that localhost worker in browser DevTools before development.

Run `npm run build:pwa` after changing worker source or precached files; do not edit
the generated worker manually. Workbox 7.4.1 and esbuild 0.28.1 are approved build
dependencies, bundled locally without a CDN. An update
waits until the previous worker no longer controls any open tabs/windows, including
the installed app. It does not automatically call `skipWaiting` or force a page reload, so it
does not interrupt editing. Reopen the app after closing all its windows to use
an available update. The app now also shows an update notice for an already waiting
worker or one installed while the page is open. **อัปเดตตอนนี้** opens a confirmation
asking the user to save work first. Confirmation activates the waiting worker and
reloads only that window; existing beforeunload guards can still cancel the reload.
Other windows show **โหลดเวอร์ชันใหม่** and never reload automatically. **ภายหลัง**
collapses the notice to a small button so it can be reopened. The notice sits at
the top of the screen with safe-area spacing on mobile. Its user-facing copy is
**มีเวอร์ชันใหม่พร้อมใช้งาน / กรุณาบันทึกงานที่กำลังทำก่อนอัปเดต**, with
**อัปเดตตอนนี้ / ไว้ทีหลัง** buttons and touch targets at least 44px high.

Worker identity includes a deterministic hash of application source and dependency
manifests, in addition to public asset revisions, so app-code releases also trigger
the notice. Environment files and credentials are excluded. An environment-only
change does not itself change this source fingerprint. Checks run on focus and
returning online; no notification permission or Push service is involved.

Older workers that do not support the activation message time out with instructions
to save work and close all WeBooks windows, rather than reloading unexpectedly.
The new UI itself must first be loaded from a deployment; a page already running
older JavaScript cannot retroactively acquire this UI without reopening/reloading.

No database changes are required. Push Notification and Store
distribution are deferred by the user and are outside this release's acceptance scope.

## Verification

Automated worker tests execute the shipped script inside a VM with simulated
browser Cache/Fetch APIs. They check offline fallback, privacy boundaries,
network pass-through, HTTP errors, revision lookup, failed installation, obsolete
revision cleanup, offline assets, and conservative updates. A build test verifies
the committed worker is reproducible and public-file edits change the artifact.

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
