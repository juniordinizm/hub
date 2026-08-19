# Certificate Editor Preview Toolbar and Density Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the certificate editor canvas-first, compact, and consistent by moving global actions into the preview header and simplifying the inspector.

**Architecture:** Preserve the existing DOM preview, normalized field model, and contextual inspector. Move only presentation/state wiring needed for the toolbar and diagnostics, use existing design-system primitives with compact variants, and keep the native color input as the single primary color interaction.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, existing UI primitives, Vitest/jsdom, Ultracite/Biome.

---

### Task 1: Add failing tests for the revised information architecture

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`

- [ ] **Step 1: Assert toolbar ownership and copy.**

Add expectations that the toolbar is inside the preview header, has no `data-properties-toolbar`, contains icon-only center/undo/fields controls, and exposes exactly one sample-data toggle whose accessible name is `Dados longos` or `Dados curtos`.

- [ ] **Step 2: Assert removed and moved controls.**

Assert no button named `Origem`, no below-preview diagnostic inside the preview section, and direct diagnostics inside `[data-properties-panel]`.

- [ ] **Step 3: Assert compact property structure.**

After selecting a text field, assert position and size legends are separate, alignment legend and toggles share the same row, and geometry values contain no decimal comma.

- [ ] **Step 4: Run the focused editor tests and record the expected failures.**

Run:

```powershell
bun run test -- "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts"
```

Expected: the new assertions fail against the current properties-toolbar and Popover-based color picker.

### Task 2: Move and normalize the preview toolbar

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-visibility-sheet.tsx` only if the trigger needs compact icon styling

- [ ] **Step 1: Move global actions into the preview header.**

Render undo, horizontal center, vertical center, visibility sheet, and sample-data toggle beside the `Preview` title. Remove the properties toolbar section and the origin action. Keep icon buttons `size="icon-xs"`, `aria-label`, and `title`; keep the sample toggle as a compact text button.

- [ ] **Step 2: Rename sample-data states.**

Use `Dados curtos` when `previewVariant === "short"` and `Dados longos` when it is `long`, with `aria-pressed` reflecting the long state.

- [ ] **Step 3: Remove redundant workspace constraints.**

Remove outer padding and redundant rounded/background surface around the split workspace. Keep the session card and certificate art boundary; let the preview column stretch to the available width.

- [ ] **Step 4: Run editor tests for selection, undo, centering, visibility, and sample data.**

Expected: all existing behavior tests pass after selector updates.

### Task 3: Compact and regroup inspector controls

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Split geometry into position and size groups.**

Render two fieldsets with legends `Posição` and `Tamanho`; put only `x/y` controls in the first and `width/height` in the second. Remove the explanatory unit paragraph.

- [ ] **Step 2: Use compact integer geometry controls.**

Change geometry input/slider steps to `1`, format values with `Math.round`, and keep clamping. Make input/select classes use compact heights (`h-7`/`size="sm"` or existing equivalent) and smaller gaps.

- [ ] **Step 3: Align typography labels and controls horizontally.**

Wrap both `AlignmentToggle` instances in the same inline property-row contract used by font size, color, and font. Preserve `fieldset`/`legend` semantics while placing the icon group to the right.

- [ ] **Step 4: Run focused inspector tests.**

Expected: position/size separation, integer formatting, and alignment row assertions pass.

### Task 4: Replace the layered color popover

**Files:**
- Modify: `src/components/ui/color-picker.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Remove Popover imports and state.**

Render a compact button/label that contains the native `<input type="color">` as the direct trigger. Keep a short HEX text input visible beside it, with validation and Enter/blur commit.

- [ ] **Step 2: Preserve accessible names and compact styling.**

Label the native color input and HEX input, keep keyboard focus-visible styles, and avoid preset swatches or a second overlay layer.

- [ ] **Step 3: Test direct color interaction.**

Update the editor test to assert no `[data-slot="popover-content"]` appears after interacting with color and that valid HEX edits update the form state.

### Task 5: Reposition and clarify diagnostics

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-overlap-notice.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Move below-preview diagnostics to properties.**

Render the overlap notice, validation field error, and no-publishable-changes hint in a compact diagnostics region at the top of the properties scroll body. Remove that region from the preview column.

- [ ] **Step 2: Make overlap copy direct.**

Change the inline copy to state the number and names of overlapping fields immediately, while retaining details only as an optional expansion. Do not imply that saving is blocked.

- [ ] **Step 3: Preserve canvas warnings.**

Keep the text-overflow status rendered over the certificate page; use direct copy such as `Texto cortado: Nome do aluno`.

- [ ] **Step 4: Run overlap/validation tests.**

Expected: below-preview diagnostics exist only in properties and canvas overflow remains in the preview DOM.

### Task 6: Verify the complete change

**Files:**
- Modify only files from Tasks 1–5 for formatting/type corrections.

- [ ] **Step 1: Run formatting and type checks.**

Run `bun x ultracite fix`, `bun run check`, and `bun run typecheck`.

- [ ] **Step 2: Run the complete test suite.**

Run `bun run test`; expected all test files and tests pass.

- [ ] **Step 3: Validate docs, migrations, and diff.**

Run `bun run docs:check`, `bun run db:migrations:check`, and `git diff --check`.
