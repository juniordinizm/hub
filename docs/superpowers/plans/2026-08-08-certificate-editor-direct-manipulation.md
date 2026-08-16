# Certificate Editor Direct Manipulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the certificate template preview into a DOM-first visual editor where an administrator can select and move one standardized field directly on the A4 preview while retaining exact numeric properties and the existing PDF contract.

**Architecture:** Keep `CertificateTemplateSpec` (`x`, `y`, `width`, `height` in percentages) as the only persisted geometry. Keep the existing DOM preview and PDFKit renderer; add a non-printing interaction layer for selection and drag, and a contextual inspector for precise keyboard-editable values. Commit one history entry per completed gesture and keep overlap advisory.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest/jsdom, existing local UI primitives, Pointer Events, existing certificate rules and PDFKit renderer.

---

### Task 1: Add tested normalized geometry helpers

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for `clampCertificateFieldPosition` and `moveCertificateFieldByPixels`. Cover a 1000x500 page and printable-area clamping without mutating the original geometry.

```ts
it("converts a pointer delta to normalized percentages and clamps it", () => {
  const field = { x: 90, y: 95, width: 20, height: 10 };
  expect(moveCertificateFieldByPixels(field, { x: 50, y: 50 }, { width: 1000, height: 500 })).toEqual({
    ...field,
    x: 80,
    y: 90,
  });
});

```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts"`.
Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Use the real page rectangle dimensions, convert pixel deltas to percentages, clamp positions to `[0, 100 - size]`, round results to one decimal place, and never mutate the input field.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same Vitest command. Expected: all geometry tests pass.

### Task 2: Add DOM-first selection and movement to the preview

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write the failing interaction tests**

Render a draft with a known `studentName` field, click its interaction layer, and assert that the inspector identifies the field. Dispatch a pointer gesture against the selected field with a mocked page rectangle and assert that the hidden `spec` input contains normalized new `x` and `y` values after pointer-up. Add a cancel test where `Escape` restores the original geometry.

- [ ] **Step 2: Run the focused editor test and verify the new assertions fail**

Run `bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"`.
Expected: FAIL because the preview has no selectable interaction layer or pointer handlers.

- [ ] **Step 3: Implement single-field selection and drag**

Add `selectedField` state to the form and pass it to the preview. Render a non-printing, focusable interaction button for each visible field, positioned with the same percentage frame. The button selects on click and begins a drag only after pointer movement; use `setPointerCapture`, the page `getBoundingClientRect()`, the geometry helper, and `onPointerUp`/`onPointerCancel`. Keep background and content layers from capturing interaction events. Pass an `onFieldChange` callback back to the form and render a selected outline and human-readable label.

- [ ] **Step 4: Add keyboard and undo behavior**

The selected interaction button must be focusable and expose an accessible label. Arrow keys adjust X/Y by 0.5 percentage points, `Shift` uses 5 points, and `Escape` cancels an active gesture. Store the pre-gesture fields snapshot and append one undo entry only on pointer-up. Do not persist viewport state or interaction handles.

- [ ] **Step 5: Run the focused editor test**

Run the focused editor test again. Expected: existing editor tests and the new selection/drag/cancel tests pass.

### Task 3: Replace repeated accordions with the contextual inspector

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write the failing inspector tests**

Assert that the initial interface renders a compact field list, selecting `studentName` renders X/Y/width/height and typography controls, and selecting `qrCode` does not render typography controls. Assert that changing the X input updates the hidden spec input and that signer name, signer role, and signature upload remain in `FormData`.

- [ ] **Step 2: Run the focused test and verify the new assertions fail**

Run the editor test file. Expected: FAIL because the current UI renders one accordion with all controls for every field.

- [ ] **Step 3: Implement a compact field list and inspector**

Replace the multiple Accordion root with a compact list of field buttons containing the human label, visibility switch, and diagnostic badge. Render one selected-field inspector. Keep signer metadata/upload grouped under `Assinatura`, while preserving `signerRole` as an independently positionable field. Reuse the existing local UI primitives and add no dependency.

- [ ] **Step 4: Gate controls by field capability**

Show position controls for every field. Show typography only for text fields. Show signer content/upload only for the signature group. Keep QR and image fields free of no-op font, color, alignment, and font-size controls. Numeric geometry inputs must accept `%`, validate on blur, and share the same `onFieldChange` path as drag.

- [ ] **Step 5: Run the focused editor test**

Run the editor test file. Expected: all updated inspector, FormData, upload, overlap, crop, keyboard, and action tests pass.

### Task 4: Verify documentation and production boundaries

**Files:**
- Modify: `docs/superpowers/specs/2026-08-07-certificate-editor-ux-ui-design.md`
- Create: `docs/superpowers/specs/2026-08-08-certificate-editor-direct-manipulation-design.md`
- Verify: `docs/domain/certificates-and-data-rights.md`

- [ ] **Step 1: Document the accepted scope change**

Record DOM-first selection, movement within the printable page, numeric inspector fallback, server-authoritative validation, advisory overlaps, and the explicit exclusion of canvas replacement and multiple selection from this phase.

- [ ] **Step 2: Run documentation validation**

Run `bun run docs:check`. Expected: documentation validation passes.

### Task 5: Full verification

- [ ] **Step 1: Run focused geometry and editor tests**

Run `bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-geometry.test.ts" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"`.

- [ ] **Step 2: Run repository checks**

Run `bun x ultracite check`, `bun run typecheck`, `bun run test`, and `bun run build`. Fix failures before reporting the branch as ready.

## Implementation status

Implemented on `codex/certificate-editor-direct-manipulation`.

- Focused editor and geometry tests: 69 passed across the editor, geometry,
  rendering and workload contract suites.
- Repository tests: 236 files and 1,530 tests passed.
- Ultracite, TypeScript, documentation validation, and production build passed.
