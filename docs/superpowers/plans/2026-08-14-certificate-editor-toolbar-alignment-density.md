# Certificate Editor Toolbar, Alignment, and Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate certificate editor actions, correct text alignment and center-based geometry, and reduce visual density while preserving direct manipulation and accessibility.

**Architecture:** Keep the existing DOM preview and normalized field specification. Add a small global toolbar to the properties column, use CSS grid/flex for the split workspace and fixed-height scrolling, and centralize resize math in the geometry module. Keep diagnostics in the preview and use the existing contextual inspector for fields/background.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, existing shadcn-style primitives, Vitest/jsdom, Ultracite/Biome.

---

### Task 1: Lock geometry and preview alignment behavior with tests

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Add geometry expectations for center preservation on both axes.**

Add tests that resize a field with `anchor: "center"` and assert both `x + width / 2` and `y + height / 2` remain unchanged, including a Shift/aspect-ratio case and a boundary case.

- [ ] **Step 2: Add preview alignment expectations.**

Extend the layout test for a right-aligned field to assert `justifyContent: "flex-end"`, and add left/center cases. This proves the visual content alignment is separate from the field frame.

- [ ] **Step 3: Add editor assertions for the new information architecture.**

Assert that the field visibility trigger is in `[data-properties-toolbar]`, that preview has no duplicate action controls, that the overlap notice is rendered in `[data-preview-diagnostics]` and not inside `[data-properties-panel]`, and that a selected field's center/reset actions are available from the toolbar.

- [ ] **Step 4: Run the focused tests and confirm the new assertions fail before implementation.**

Run:

```powershell
bun test --run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"
```

Expected: existing tests pass where unchanged, and the newly added expectations fail because the current layout/geometry still uses the alignment as an anchor and places actions in the preview/property header.

### Task 2: Make geometry center-based and text alignment content-only

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`

- [ ] **Step 1: Replace alignment-dependent width updates with center-preserving geometry updates.**

Add a helper that clamps requested width and height around the original rectangle center, preserving `centerX` and `centerY` wherever page bounds allow. Update `resizeCertificateFieldWidth` or replace its callers so `updateField` uses this helper for both `width` and `height`; never read `field.align` for geometry.

- [ ] **Step 2: Update pointer resizing to use the center anchor.**

Pass `{ anchor: "center", preserveAspectRatio: ... }` from the preview resize path. Extend the helper's bounds to clamp both x and y after resizing.

- [ ] **Step 3: Make browser text alignment explicit.**

Map `left`/`center`/`right` to `justifyContent` while retaining `textAlign` for wrapping. Keep vertical alignment mapped to `alignItems`. Do not alter normalized field coordinates when alignment toggles.

- [ ] **Step 4: Run focused geometry/layout tests.**

Run the two test files from Task 1. Expected: all geometry and layout assertions pass.

### Task 3: Build the compact global properties toolbar

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-visibility-sheet.tsx` only if trigger composition needs a stable toolbar hook
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Define toolbar props and actions.**

Expose `data-properties-toolbar` and render a compact row containing: undo, `Centralizar no A4`, `Restaurar origem`, visibility sheet trigger, and sample-data toggle. Disable selection-dependent actions when no field is selected or while busy. Use icon-only buttons only when they have `aria-label` and a tooltip/title.

- [ ] **Step 2: Remove duplicate global actions from the preview header and field inspector.**

Leave only the `Preview` heading in the preview header. Remove center/reset buttons from the field inspector and remove the undo button from the properties header. Keep save/publish in `CertificateTemplateSessionHeader`.

- [ ] **Step 3: Keep contextual content below the toolbar.**

Render `CertificateTemplateFields` after the toolbar; keep the fields sheet out of the main inspector until opened and keep background properties contextual.

- [ ] **Step 4: Run editor integration tests for toolbar placement and action behavior.**

Run the editor test file. Expected: selection, undo, visibility sheet, and sample data tests pass with the new DOM locations.

### Task 4: Reduce density and standardize property rows

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/components/ui/color-picker.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Test: `src/components/ui/color-picker.test.tsx` if present, otherwise add `src/components/ui/color-picker.test.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Add a reusable inline property-row pattern.**

Use a two-column `label`/`control` row with `min-w-0`, `items-center`, and a responsive fallback. Apply it to signer inputs, font size, font select, color, and geometry values. Keep fieldsets semantically grouped.

- [ ] **Step 2: Simplify geometry units.**

Show one legend `Unidade: % da página A4` and compact numeric values without repeating `%` in every label. Keep range sliders, min/max clamping, `step=0.1`, and accessible `aria-valuetext`.

- [ ] **Step 3: Remove color presets and make HEX the first interaction.**

Delete the preset array/grid. Add a ref and `onOpenAutoFocus` to focus the hexadecimal input; retain the native color input as a secondary swatch control. Support Enter/blur commit and restore invalid drafts.

- [ ] **Step 4: Update color-picker tests and run focused UI tests.**

Assert no `[data-color-preset]` nodes exist, the HEX input is present, and valid input calls `onChange`. Run the picker and editor tests.

### Task 5: Simplify the workspace and centralize diagnostics

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-overlap-notice.tsx` only for compact preview diagnostics styling
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx` only for diagnostic wrapper hooks
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Replace nested cards with one split workspace.**

Use a single `div` with `grid`, `min-h-0`, `overflow-hidden`, and one border/radius surface. Give each column a thin header and internal content. Keep the preview frame itself as the only visual surface around the certificate art.

- [ ] **Step 2: Remove JavaScript height measurement.**

Delete `previewCardRef`, `previewPanelHeight`, and the `ResizeObserver` height effect. Set a CSS grid height using `min()`/`dvh`, set both columns `min-h-0`, and give the properties body `h-full overflow-y-auto overflow-x-hidden`.

- [ ] **Step 3: Put editor diagnostics in one preview-only region.**

Render overlap notice, text overflow status, and no-publishable-changes hint under `[data-preview-diagnostics]`. Remove the overlap notice from the properties body. Keep action/issuer errors in the session-level notice area because they describe save/publish prerequisites rather than the artwork.

- [ ] **Step 4: Run integration tests and inspect DOM invariants.**

Run the editor test file and use `Select-String`/test selectors to confirm no `[data-properties-panel]` horizontal overflow class or duplicate diagnostic region remains.

### Task 6: Format, type-check, and complete verification

**Files:**
- Modify only files from Tasks 1–5 as needed for lint/type fixes.

- [ ] **Step 1: Run Ultracite autofix and check.**

Run `bun x ultracite fix`, then `bun x ultracite check`. Expected: no formatter or lint errors.

- [ ] **Step 2: Run typecheck and focused tests.**

Run `bun run typecheck` and the three editor/geometry/layout tests. Expected: all pass.

- [ ] **Step 3: Run repository verification.**

Run `bun run test`, `bun run docs:check`, and `bun run db:migrations:check`. Expected: pass; report any pre-existing unrelated failure explicitly.

- [ ] **Step 4: Review the diff for scope and accessibility.**

Run `git diff --check` and inspect changed files for stable labels, focus-visible classes, no `console.log`, no new dependencies, and no accidental API/schema changes.
