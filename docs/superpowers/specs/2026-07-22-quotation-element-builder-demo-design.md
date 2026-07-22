# Quotation Element Builder Demo Design

**Date:** 2026-07-22

**Status:** Approved design, awaiting written-spec review

## Goal

Build a standalone interactive prototype that demonstrates how element-level
quotation layout editing would feel before deciding whether it belongs in the
production quotation system.

## Scope

The demo uses a three-panel desktop document-builder layout:

- a layer tree on the left;
- a portrait A4 canvas in the center;
- properties for the selected layer on the right.

The canvas contains representative quotation layers for the logo, seller
details, document title and metadata, item table, totals, and certification
area. The certification area visibly includes the issuer, approver, company
stamp, and customer recipient.

The prototype is separate from the production application. It does not modify
quotation data, Supabase, authentication, APIs, Print, PDF, or Public Read-only.

## Interactions

- Select a layer from either the layer tree or the canvas.
- Drag an unlocked layer within the A4 canvas.
- Resize the selected layer with a visible resize handle.
- Edit numeric X, Y, width, and height values from the properties panel.
- Lock or unlock a layer.
- Show or hide a layer.
- Move a layer forward or backward in the stacking order.
- Nudge an unlocked selected layer with the arrow keys.
- Undo changes made during the current session.
- Reset every layer to the initial layout.
- Toggle Preview to hide editing outlines and controls.

Dragging, resizing, and numeric changes are constrained to the A4 canvas. The
item table and certification area move as whole demo layers; the prototype does
not edit their internal business data.

## Responsive Behavior

The working editor is optimized for desktop because precise A4 composition
requires a large canvas. Tablet and mobile stack the layer list, canvas, and
properties vertically while retaining selection and numeric controls. Pointer
interactions use the native Pointer Events model so mouse, pen, and touch share
the same behavior.

## Error And Recovery Behavior

- Invalid numeric values revert to the last valid value.
- Movement and resizing cannot place a layer outside the canvas.
- Locked layers ignore drag, resize, nudge, and numeric position changes.
- Undo is disabled when no prior state exists.
- Reset restores the complete initial demo state.

The page contains a small startup self-check that verifies the initial layers
have unique IDs and fit inside the canvas.

## Visual Direction

Follow the previously approved element-builder mockup: restrained admin UI,
three clear work areas, a white A4 canvas, blue-violet selection treatment, and
the current quotation's document language. Use real project logo imagery and
plain UI controls; do not invent a separate brand direction.

## Out Of Scope

- Saving or loading layouts;
- multiple document pages or pagination;
- real quotation calculations or content editing;
- real PDF, Print, or Public rendering;
- reusable template creation;
- history across browser reloads;
- collaboration, permissions, or publishing;
- production application changes or new dependencies.

## Verification

Verify the rendered prototype at desktop, tablet, and mobile widths. Test layer
selection, drag, resize, numeric properties, lock, visibility, stacking order,
keyboard nudge, Preview, Undo, and Reset. Check that no layer can leave the A4
canvas and that the browser console has no errors.

## Acceptance Criteria

- The prototype opens independently from the production application.
- The three-panel builder matches the approved visual concept.
- All listed core interactions work with representative quotation layers.
- The initial document passes its startup bounds self-check.
- No production code, database, API, dependency, or PDF behavior changes.
