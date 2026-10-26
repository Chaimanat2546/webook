# Sheet spacing and responsive notification settings

Keep the session/logout work deferred. Apply a shared bottom-sheet minimum of
24px plus the device bottom safe area in `components/ui/sheet.tsx`, using a
bottom-side variant so existing plain `p-0` / `pb-*` callsites cannot erase it.
Side panels retain their current spacing.

Notification settings keep the header icon and existing Push operations. Mobile
uses the bottom Sheet; Desktop uses the existing centered Dialog. Present Push
state, explanation and full-width 44px actions in a compact card. Keep copy scoped
to the current account/device; no new notification/session behavior or dependency.

Verify responsive dismissal/focus, resizing, list scroll preservation, both themes,
and effective padding across existing bottom-sheet class overrides and right-side
panels. Run existing Push tests, UI tests, build/typecheck/lint and review.

## Verification
- Next build and TypeScript passed; ESLint has zero errors (11 existing warnings).
- Full suite: 1,293 passed, 4 opt-in tests skipped, zero failures after regenerating PWA worker.
- Browser fixture at 390x844: bottom sheet reaches viewport bottom, computed bottom padding 24px, action height 44px. Device safe-area inset is zero in this desktop browser fixture; physical iOS safe-area not simulated.
- Shared primitive fixture: p-0, pb-0 and legacy safe-area-only classes each retain 24px; right panel remains at 0px with p-0.
- Desktop 1280x900: centered 448px Dialog, nested in notification right Sheet. Escape/X return focus to settings trigger; payment filter and scrollTop 1266 retained.
- Resizing an open Desktop dialog to mobile leaves no overlay/pointer lock; settings reopen as bottom Sheet.
- Independent source review approved. No auth/session changes, migrations or dependencies.
- Local implementation only; deployment has not been performed for this round.
