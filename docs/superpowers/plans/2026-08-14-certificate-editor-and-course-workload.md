# Certificate Editor and Course Workload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the unused course-free certificate field, move workload overrides to course settings, and simplify the certificate editor around grouped fields and contextual properties.

**Architecture:** Keep the existing DOM-first certificate preview and normalized percentage geometry. Make the course own an optional nullable workload override; the effective workload is `override ?? derived lesson workload`, while certificate snapshots remain immutable. Treat issuer data, document settings, signature, automatic values, and validation assets as separate editor concerns.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL/Drizzle migrations, Vitest, shadcn-style UI primitives.

---

### Task 1: Establish the new workload contract

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0059_course_workload_override_and_certificate_cleanup.sql`
- Modify: `src/db/migrations/meta/_journal.json`
- Create: `src/db/migrations/meta/0059_snapshot.json`
- Modify: `src/features/courses/workload.ts` (create if absent)
- Test: `src/features/courses/workload.test.ts`

- [ ] Write tests for non-negative nullable override parsing and effective workload resolution.
- [ ] Run the focused workload tests and verify the new tests fail before implementation.
- [ ] Add `courses.workload_hours_override` as nullable non-negative integer.
- [ ] Remove `certificate_templates.certificate_workload_hours` from the live schema through a forward migration; keep historical certificate render snapshots unchanged.
- [ ] Drop `certificate_issuer_profiles.course_free_statement` through the same forward migration.
- [ ] Add `parseCourseWorkloadOverride` and `resolveCourseWorkloadHours` with explicit `null` meaning “derive from lessons”.
- [ ] Update migration metadata using the repository's migration generator or the existing checked-in format, without rewriting historical snapshots.
- [ ] Run the focused tests and verify they pass.

### Task 2: Apply the workload contract to course authoring and student reads

**Files:**
- Modify: `src/features/admin/authoring.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/server.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Modify: `src/features/courses/server.ts`
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/certificates/rendering.ts`
- Modify: relevant course/certificate tests

- [ ] Add `workloadHoursOverride` to admin course view models and course settings form data.
- [ ] Persist the nullable override when saving a course; preserve the existing derived calculation when it is null.
- [ ] Make recalculation resolve `override ?? derived` for the current course value while continuing to update publication workload snapshots from lesson durations.
- [ ] Make student course views, public previews, certificate eligibility, and new certificate snapshots use the course override when present.
- [ ] Keep already issued certificates unchanged through their stored workload snapshots.
- [ ] Add UI copy showing both the calculated workload and the manual override state.
- [ ] Add tests for clearing the override, setting it, lesson recalculation with and without override, student display, and certificate issuance.

### Task 3: Remove course-free data end-to-end

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/server.ts`
- Modify: `src/app/(admin)/admin/configuracoes/page.tsx`
- Modify: `src/features/certificates/template-rules.ts`
- Modify: `src/features/certificates/render-snapshot.ts`
- Modify: `src/features/certificates/rendering.ts`
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/certificates/templates.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: field labels, seed scripts, integration fixtures, and all affected tests

- [ ] Remove `courseFreeStatement` from the field union, defaults, required/optional behavior, preview values, rendering values, and snapshot schema.
- [ ] Remove issuer settings input, action parsing, SQL columns, selects, seed values, and view-model properties.
- [ ] Preserve legacy render snapshots as opaque historical evidence; do not mutate already issued certificate records.
- [ ] Add a regression test proving a new template cannot contain the removed field and a new render snapshot does not require it.
- [ ] Search the repository for both camelCase and snake_case names and leave no live-code references outside historical migration/snapshot evidence.

### Task 4: Rebuild certificate field taxonomy and labels

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-field-labels.ts`
- Create or modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-field-metadata.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-visibility-sheet.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: editor tests

- [ ] Define grouped metadata for automatic content, issuer, signature, and validation fields, including source and required/optional status.
- [ ] Replace terse labels with user-facing labels such as `Nome no certificado`, `Título do curso`, `Nome do emissor`, and `Código de validação`.
- [ ] Group the right-side field sheet by intent and show compact source/status badges.
- [ ] Keep required fields protected from hiding and show missing-asset diagnostics for visible signature images.
- [ ] Move workload configuration out of the selected field inspector and expose it under course settings only.
- [ ] Represent signature name, role, and image as one contextual signature block while preserving the existing persisted fields and geometry callbacks.
- [ ] Add tests for grouping, labels, source badges, required visibility, and signature asset state.

### Task 5: Reduce inspector density without changing the geometry contract

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-overlap-notice.tsx`
- Modify: shared UI primitives only where required by the traced surface
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] Keep the preview as the primary positioning surface and put numeric geometry controls behind a compact advanced section.
- [ ] Render only controls relevant to the selected field type: text styling for text, asset controls for images, geometry for every visual object.
- [ ] Use a thin properties header with field label, source badge, visibility, and undo; remove duplicate status copy.
- [ ] Move background art to document properties and keep its uploaded-image state as a subtle replacement/removal card.
- [ ] Keep the right-side sheet for field visibility and selection; remove field-list duplication from the preview column.
- [ ] Make overlap feedback compact and non-blocking, with a single actionable indicator instead of repeated inline prose.
- [ ] Preserve keyboard movement, resize, snap guides, direct dragging, and normalized PDF geometry.
- [ ] Add component tests for contextual controls and no duplicate workload/course-free controls.

### Task 6: Update canonical documentation and verify the release

**Files:**
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/domain/learning-content-and-progress.md`
- Modify: `docs/adr/0006-certificate-lifecycle.md` if the workload snapshot wording requires clarification
- Modify: `docs/README.md` only if the canonical map changes
- Modify: `docs/operations/database-and-migrations.md`

- [ ] Document that course workload is `manual override ?? sum of lesson durations` and that the certificate consumes the course's effective workload.
- [ ] Document that course-free statement is no longer a supported issuer/template concept and that historical certificate snapshots are immutable.
- [ ] Update migration/runbook instructions for the new forward migration.
- [ ] Run focused tests, typecheck, lint/format checks, docs check, and production build.
- [ ] Search live source for removed identifiers and inspect the final diff before reporting completion.
