# Certificate Editor Toolbar, Alignment, and Density

## Status

Approved for implementation by the product owner on 2026-08-14.

## Goal

Make the certificate editor simpler and more predictable by consolidating global actions into a compact properties toolbar, making field geometry center-based, making text alignment affect only the content inside each field, and reducing visual density without removing direct manipulation.

## Decisions

- Use a single workspace split into preview and properties; remove nested card surfaces around both columns.
- Keep the preview header to the title only. Global actions live in the first, compact properties section.
- The toolbar contains undo, center/reset actions for the selected field, sample-data toggle, and the field visibility sheet trigger.
- Keep server/action errors in the session header. Keep editor diagnostics (overlap, text overflow, and no publishable changes) in one compact diagnostic area inside the preview.
- Keep the background inspector contextual: it opens only when the preview background is selected.
- Treat `x`/`y` as the top-left storage coordinates, but preserve the rectangle center whenever width or height changes. Text alignment (`left`, `center`, `right`) never changes geometry.
- Render text fields as flex containers with both `textAlign` and horizontal `justifyContent`, so alignment is visible even when the field is a flex box.
- Keep numeric controls and sliders, but expose one unit legend (`% da página A4`) and compact fixed numeric inputs to avoid repeated/confusing percentage labels.
- Use an inline property-row pattern with label on the left and control on the right. Color picker has no preset swatches and focuses the hexadecimal input when opened.
- Preserve Shift resize aspect ratio and keep keyboard/mouse access paths.

## Scope

### In scope

- `certificate-template-form.tsx`: workspace layout, toolbar, diagnostics placement, CSS-only panel sizing, center-based field updates.
- `certificate-template-fields.tsx`: toolbar controls, compact property rows, geometry unit treatment, contextual inspectors.
- `certificate-template-preview.tsx` and `certificate-template-preview-layout.ts`: text alignment and center resize interaction.
- `certificate-template-geometry.ts`: center-preserving width/height resize helpers.
- `src/components/ui/color-picker.tsx`: minimal HEX-first picker without presets.
- Focused unit/integration tests for geometry, alignment, picker, toolbar placement, diagnostics, and accessibility labels.

### Out of scope

- Replacing the DOM preview with Konva/Fabric or adding a new UI dependency.
- Group selection, multi-field transforms, undo history persistence, or PDF renderer changes.
- Changing the certificate storage/API contract.

## Acceptance criteria

1. Preview and properties are aligned in one split workspace; no preview card nested inside another preview card.
2. Properties has a fixed CSS layout height with internal vertical scrolling and no horizontal overflow.
3. The first properties section is a compact toolbar with global actions; preview header contains only `Preview`.
4. Selecting a field shows its inspector; selecting the background shows only background properties.
5. Centering/resizing a field preserves its rectangle center; changing text alignment changes rendered text position inside the same rectangle.
6. Color picker opens with a focused HEX input and contains no preset swatches.
7. Editor diagnostics appear only below/within preview; server save/publish errors remain session-level.
8. Geometry inputs expose stable numeric values and one clear `% da página A4` unit explanation.
9. All controls retain accessible names, visible focus states, keyboard movement/resizing, and Shift aspect-ratio behavior.

## Verification

- `bun test --run src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.ts`
- `bun run typecheck`
- `bun x ultracite check`
- `bun run docs:check`
