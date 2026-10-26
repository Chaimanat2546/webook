# Notification settings bottom sheet

Move device notification settings out of the inbox footer to a labelled settings
icon in the top-right header on the mobile page and Desktop notification panel.
Use the existing shadcn `Sheet` with `side="bottom"`, preserving the current
`PushSettings` component and all consent/subscription behavior. No new dependency.

Keep header height and 44px touch targets, existing theme tokens and safe-area
padding. Provide a title, description, close action, focus return and Escape
behavior. Closing the nested settings sheet must keep the Desktop inbox open.

1. Add a shared settings trigger/sheet feature component; place it in both headers.
2. Remove footer settings and its unused imports from the inbox.
3. Update UI coverage and documentation. Verify mobile/Desktop interaction,
   keyboard focus, nested sheets, overflow and unchanged list scroll/filter state.
4. Run relevant tests, build/typecheck/lint and independent review before release.
