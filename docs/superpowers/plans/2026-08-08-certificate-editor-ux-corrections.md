# Certificate Editor UX Corrections Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with verification after each vertical slice. No commit is required for this work.

**Goal:** Corrigir os problemas prioritários e refinamentos secundários do editor de certificado sem alterar o contrato persistido nem a autoridade do renderer PDFKit.

**Architecture:** Manter o preview DOM-first, a especificação percentual como fonte única e o inspector contextual. A compactação será controlada por uma variante local do `Card`; a seleção e o Sheet continuarão usando os primitives existentes, com uma única área de rolagem por superfície. Inputs numéricos terão estado textual temporário e commit normalizado para não converter edição vazia em zero.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Tailwind CSS, Radix UI primitives, Vitest, Ultracite.

---

### Task 1: Compactar a moldura do editor

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`

- [ ] Add a `density` prop to `Card` with `default` and `compact` values. The compact variant must set `--card-spacing` to zero and preserve the existing public default.
- [ ] Apply compact density to the outer editor card and the Preview/Properties cards. Keep explicit `py-2` headers and `p-4` content padding.
- [ ] Remove the border-header variant's implicit large bottom padding for compact cards by applying `pb-2` after the header's border class.
- [ ] Verify the form still renders the preview and inspector at desktop and mobile breakpoints with `bun run typecheck`.

### Task 2: Fechar semântica e foco

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx`

- [ ] Add an `as` prop to `CardTitle` for `h2`/`h3`/`div` without changing its visual classes.
- [ ] Render the session title as `h2`, Preview and Properties as `h3`, and retain the existing visual hierarchy.
- [ ] Replace raw inspector action buttons with the shared `Button` primitive or give them the same explicit `focus-visible` ring contract.
- [ ] Add visible focus and keyboard tests for field relationship, centering, and reset controls at the existing editor test seam.

### Task 3: Corrigir limites do Sheet, inspector e canvas

**Files:**
- Modify: `src/components/ui/sheet.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-visibility-sheet.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`

- [ ] Add `overscroll-contain` to Sheet content and its scroll body; keep the Sheet on the right.
- [ ] Keep the Properties scroll container `overflow-x-hidden overscroll-contain` and avoid a second scroll owner.
- [ ] Move the selected-field label inside the printable frame with a safe top/bottom placement so it cannot be clipped by `overflow-hidden`.
- [ ] Add a non-destructive visual/text diagnostic when preview text overflows instead of silently hiding it.

### Task 4: Melhorar sliders e inputs numéricos

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] Add visible min/max endpoint labels to geometry sliders and apply `tabular-nums` to changing values.
- [ ] Keep the numeric input as the precision path; stage its text while editing and clamp/commit on blur or Enter.
- [ ] Apply the same safe editing behavior to workload hours, font size, and color-independent numeric controls.
- [ ] Add tests proving an empty intermediate input does not immediately become zero and that commit clamps to the documented range.

### Task 5: Separar propriedades do documento e do campo

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`

- [ ] Render background art in a compact `Documento` section with clear separation from the selected field inspector.
- [ ] Keep the image replacement/removal card subtle when an image exists and preserve the existing staged-upload behavior.
- [ ] Keep signature content grouped while preserving independent positioning of signer name, role, and image.
- [ ] Keep workload override editable and explain the fallback to course hours in one concise description.

### Task 6: Tipografia, superfícies, motion e copy

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx`
- Modify: `src/components/ui/switch.tsx`
- Modify: `src/app/globals.css`

- [ ] Add deliberate wrapping/clamping classes to preview text and keep long content reachable through diagnostics.
- [ ] Remove the nested double-frame treatment where it does not add hierarchy; preserve one subtle image outline and concentric radii.
- [ ] Replace `transition-all` with the exact switch properties that change.
- [ ] Normalize Portuguese copy and punctuation, add `autocomplete` to signer inputs, and use `text-wrap`/`tabular-nums` where values change.
- [ ] Preserve reduced-motion behavior and existing press scale values.

### Task 7: Verification

**Files:**
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`

- [ ] Run the focused certificate editor tests.
- [ ] Run `bun x ultracite check`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run test`.
- [ ] Run `bun run docs:check` and `git diff --check`.

