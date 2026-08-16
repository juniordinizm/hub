---
status: accepted
owner: engineering
last_verified_commit: 10508a4
---

# Certificate editor: direct manipulation in preview

**Approved by the user on 2026-08-08.** This document complements and
supersedes the previous non-goal that excluded drag-and-drop.

## Goal

Turn the certificate preview into a visual editor: an administrator can select
a standardized field directly on the landscape A4 page, move it inside the
printable area, and adjust its properties in a contextual inspector.

## Decisions

1. The first phase uses a hybrid DOM-first architecture. The current DOM
   preview continues to render text, QR, and images; a non-printing layer
   provides selection, movement, future handles, and guides.
2. `CertificateTemplateSpec` remains the only source of truth. `x`, `y`,
   `width`, and `height` remain normalized percentages; zoom and guides are
   transient viewport state.
3. The PDFKit renderer remains the authority for overflow, fonts, line breaks,
   and the emitted file.
4. Movement is free inside the printable area. Field overlap is advisory and
   remains allowed; out-of-page geometry remains a structural error and is
   clamped client-side and validated on the server.
5. The numeric inspector is required as a precise and accessible path. Drag is
   an accelerator, not the only way to edit geometry.
6. The first phase supports single selection, movement, keyboard nudging, and
   one undo entry per gesture. Advanced resize, multiple selection, rotation,
   warp, and renderer replacement are out of scope.

## Flow

- Clicking a visible field selects it and opens its properties.
- Dragging the field changes X/Y percentages and updates the preview in real time.
- `Escape` cancels the gesture; `Ctrl/Cmd+Z` undoes one complete operation.
- A compact list remains available for hidden or overlapping fields.
- The inspector shows only properties applicable to the field type.
- Save and publish remain allowed when the only diagnostic is overlap.

## Domain boundaries

- no arbitrary fields or free HTML;
- no persisted pixels, transforms, zoom, or guides;
- no geometry outside the printable area;
- no replacement of PDFKit with a canvas engine in this phase;
- no typography controls without effect for QR Code and signature images.

## Verification

- tests for pixel/percentage conversion, clamping, and cancellation;
- tests for selection, drag, keyboard, and undo in the editor;
- tests for synchronization between inspector, preview, and submitted `spec`;
- tests preserving uploads, signature data, and overlap warnings;
- `bun run docs:check`, `bun x ultracite check`, `bun run typecheck`, tests, and build.
