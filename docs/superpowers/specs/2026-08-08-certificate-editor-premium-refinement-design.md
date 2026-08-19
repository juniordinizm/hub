# Certificate Editor Premium Refinement — Design

**Date:** 2026-08-08  
**Status:** Approved for implementation  
**Scope:** Admin certificate-template editor and the certificate rendering contract

## Outcome

The certificate editor will use a contextual, canvas-first workflow. The preview is
the primary surface for selecting and positioning a field; the inspector edits the
selected field; the complete field/visibility inventory is opened on demand in a
Sheet. The layout keeps the existing dark-teal product identity and existing UI
primitives while removing the always-visible list and nested-scroll density.

## Product decisions

### 1. Application frame

The editor is divided into:

- a compact action bar with status, undo, reset, save, publish and sample-data
  controls;
- the A4 preview as the main workspace;
- a contextual inspector showing only the selected field;
- a `Campos e visibilidade` Sheet for the complete field inventory.

The Sheet remains available on desktop and becomes the natural full-width tray on
small screens. It owns visibility switches and field selection, but not field
geometry or content controls. Selecting a layer from the Sheet selects the same
field in the preview and inspector.

### 2. Contextual inspector

The inspector has one field header and three intentional groups:

- **Conteúdo:** field-specific values and assets;
- **Posição e tamanho:** X, Y, width and height;
- **Aparência:** horizontal/vertical alignment, font, size and color where valid.

The groups are fieldsets, not one accordion per certificate field. A field header
shows its human label, type, visibility and overlap warning. All edits remain
available by keyboard and through numeric inputs, even when direct manipulation is
used.

### 3. Direct manipulation and sliders

The preview remains DOM-first and uses the normalized percentage spec as its single
coordinate source. A selected field can be dragged and adjusted with keyboard
nudges. Geometry controls use a slider paired with a numeric input:

- X/Y: 0–100 minus the opposite dimension;
- width/height: 1–100 minus the current origin;
- 0.1 numeric precision; a live slider update; one undo entry on commit;
- labels include the value and `%` unit; the input is the accessible precision path.

The same pattern is used for font size only where it improves discoverability; it
is not added to asset-only fields. Radix Slider remains the implementation source,
with keyboard Home/End/Page/Arrow behavior and `onValueCommit` for history grouping.

### 4. Vertical text alignment

`CertificateTemplateField` gains `verticalAlign: "top" | "middle" | "bottom"`.
Missing values in legacy specs normalize to `middle`. The preview and PDF renderer
both consume the same value. Horizontal alignment remains `align`.

This distinguishes text inside its box from the box position on the page and avoids
the current top-biased data presentation.

### 5. Signature content and position

`signerName`, `signerRole` and `signatureImage` each expose their own content and
geometry when selected. The selected signer field no longer owns an unrelated
three-field form. A compact related-fields affordance may select the complete
signature block, but each field remains explicit and independently movable.

### 6. Background and signature assets

An empty asset uses the existing dropzone. An existing asset uses a compact card
with thumbnail/name/status and `Substituir`/`Remover` actions. The previous object
key remains authoritative until a staged replacement succeeds; a failed upload
does not clear the previous asset or geometry.

### 7. Certificate workload contract

The certificate may override the course workload for future emissions. The draft and
published template store a nullable `certificate_workload_hours` integer:

- `null`: use the course workload;
- non-negative integer: print this value on the certificate.

The editor offers `Usar carga horária do curso` and `Definir no certificado` with an
integer hours input and the course value as context. Issuance resolves the effective
value, stores that value in `certificates.workload_hours_snapshot`, and preserves
the effective value in the render snapshot. Existing certificates remain immutable.

The database column is preferred over embedding the override in layout JSON because
it is template content, queryable, and consistent with signer metadata columns. The
render-snapshot parser remains backward-compatible with snapshots created before
the override existed.

## Accessibility and interaction rules

- Canvas fields are real buttons with visible focus and selection state.
- Every direct-manipulation operation has a numeric and keyboard equivalent.
- The visibility Sheet has a labelled title/description, focus return and Escape
  close behavior through the existing Sheet primitive.
- Overlap is an actionable warning, never a save blocker.
- Upload replacement/removal is explicit and preserves the old asset until success.
- Reduced-motion preferences remain respected by existing transitions.

## Verification contract

Tests must cover:

- Sheet field inventory, visibility toggles and selection synchronization;
- slider/input synchronization, bounds and a single undo entry per commit;
- vertical alignment in preview data and PDF rendering;
- signature field isolation and compact asset replacement/removal;
- workload fallback, explicit override, invalid values and render snapshots;
- legacy specs/snapshots without the new optional properties;
- migration/schema parity and the existing certificate action flows.

