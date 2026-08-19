# Certificate Editor Contextual Inspector Refinement — Design

**Date:** 2026-08-14  
**Status:** Approved for implementation  
**Scope:** Admin certificate-template editor interaction and inspector density

## Outcome

The editor keeps the preview as the primary workspace and removes controls that
compete with it. The page is always shown at a single, predictable scale. The
inspector is contextual: a selected field exposes its properties, while a click
on the empty certificate surface exposes background-art properties.

## Decisions

- The preview toolbar remains one compact row with only field visibility,
  sample-data and essential preview context actions.
- Zoom controls are removed. The preview is always rendered at 100% of its
  available panel width.
- The background uploader is not rendered in the inspector by default. A
  keyboard-accessible background hit target selects it when no field is active.
- The properties panel has a measured fixed height matching the preview card and
  owns the only vertical scroll region.
- Geometry uses four compact sliders with one numeric value per control. The
  range remains available to assistive technology without repeating min/max
  labels in the visual UI.
- Horizontal and vertical text alignment use icon toggle groups with visible
  selected state, accessible names and keyboard support.
- Color uses a small popover with a native color input and a validated HEX
  input. No new dependency is required for the editor's limited color contract.
- Width changes use the field's text alignment as an anchor: centered text grows
  from both sides, right-aligned text grows toward the left, and left-aligned
  text keeps its left edge. Pointer resizing with Shift preserves the rendered
  box aspect ratio and remains bounded by the page.

The stored field schema, PDF renderer and upload contract remain unchanged.
