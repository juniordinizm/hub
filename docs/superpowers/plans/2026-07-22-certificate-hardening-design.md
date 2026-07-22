# Certificate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make certificate templates, immutable PDF issuance, and the administrative authoring experience safe, recoverable, and consistent with the existing shadcn interface.

**Architecture:** Keep the Course-owned template and outbox design. Reconcile the Drizzle schema with the already-applied catalog before generating any future migration. A dedicated snapshot parser, image asset pipeline, and rendering claim isolate untrusted input, private R2 objects, and once-only artifact generation. The Admin editor composes existing shadcn primitives and existing banner crop infrastructure rather than introducing a second visual system.

**Tech Stack:** Next.js App Router, React 19, shadcn/radix-luma, Postgres/Neon, Drizzle, R2/S3, Sharp, PDFKit, Vitest, Playwright.

---

### Task 1: Reconcile Drizzle authority

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations/meta/0037_snapshot.json`
- Modify: `src/db/migrations/meta/_journal.json`
- Test: `scripts/check-migrations.ts`

- [ ] **Step 1: Write a catalog parity assertion**

Add a test/script assertion that requires `certificates.certificate_template_id`, the two certificate enums, the issuer/template tables, and rejects an unmigrated `course_publications.certificate_template_id` declaration.

- [ ] **Step 2: Run the parity assertion and confirm red**

Run: `bun run db:migrations:check`

Expected: the assertion identifies the current schema/snapshot mismatch.

- [ ] **Step 3: Restore one authoritative Drizzle snapshot**

Use interactive `drizzle-kit generate` against the corrected TypeScript schema to produce a fresh current snapshot. Keep SQL as a reviewed no-op only when the catalog already contains the change; otherwise create a forward-only migration. Do not hand-edit the journal or snapshots.

- [ ] **Step 4: Validate in an empty Neon branch**

Apply the entire chain to a disposable branch and verify `information_schema.columns` contains the expected certificate fields and does not contain `course_publications.certificate_template_id`.

- [ ] **Step 5: Run the migration checks**

Run: `bun run db:migrations:check`

Expected: PASS with schema, SQL, journal, and snapshot agreement.

### Task 2: Validate and persist certificate image assets

**Files:**
- Create: `src/features/certificates/template-image.ts`
- Create: `src/features/certificates/template-image.test.ts`
- Create: `src/features/certificates/template-crop.ts`
- Create: `src/features/certificates/template-crop-dialog.tsx`
- Modify: `src/features/certificates/templates.ts`
- Modify: `src/features/admin/actions.ts`

- [ ] **Step 1: Write failing image-contract tests**

Cover a valid A4 landscape WebP, an invalid payload that claims `image/png`, and a valid image with non-A4 dimensions. Expected output is normalized WebP at the declared A4 landscape dimensions.

- [ ] **Step 2: Implement the shared image contract**

Model it after `banner-image.ts` and `banner-upload.ts`: content type/size checks, Sharp decoding, exact output dimensions, and server-side WebP normalization. Keep certificate constants and errors in the certificate feature.

- [ ] **Step 3: Reuse crop behavior**

Model the dialog after `BannerCropDialog`; use `react-easy-crop`, shadcn `Dialog`, `Slider`, and `Button`, but parameterize it with the certificate A4 landscape ratio and certificate crop output name.

- [ ] **Step 4: Persist only validated assets**

Make `uploadCertificateBackground` accept the normalized output. If draft persistence fails after upload, delete the newly-created private object. Keep existing referenced assets intact.

- [ ] **Step 5: Run focused tests**

Run: `bun test src/features/certificates/template-image.test.ts`

Expected: PASS for accepted, malformed, normalized, and cleanup scenarios.

### Task 3: Make the template and issuer contract explicit

**Files:**
- Create: `src/features/certificates/render-snapshot.ts`
- Create: `src/features/certificates/render-snapshot.test.ts`
- Modify: `src/features/certificates/template-rules.ts`
- Modify: `src/features/certificates/templates.ts`
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/admin/actions.ts`

- [ ] **Step 1: Write failing parser tests**

Test malformed JSON, missing fields, unknown field keys, invalid style values, duplicate fields, and a valid snapshot. The public seam is `parseCertificateTemplateDraft` and `parseCertificateRenderSnapshot`.

- [ ] **Step 2: Implement Zod-backed parsing**

Replace `JSON.parse(...) as CertificateTemplateSpec` with parsers that return safe typed data or a domain validation error. Define one `CertificateRenderSnapshot` that contains the immutable issuer display name, legal name, CNPJ, course statement, exact template version, asset keys, and validated fields.

- [ ] **Step 3: Enforce publish preconditions**

Require the global issuer profile before publishing, and snapshot the brand display name rather than silently substituting legal name. Return an actionable domain error when prerequisites are absent.

- [ ] **Step 4: Run focused tests**

Run: `bun test src/features/certificates/template-rules.test.ts src/features/certificates/render-snapshot.test.ts`

Expected: PASS.

### Task 4: Reserve and render an artifact exactly once

**Files:**
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/outbox/delivery.ts`
- Create: `src/features/certificates/rendering.test.ts`
- Modify: `src/features/outbox/delivery.test.ts`

- [ ] **Step 1: Write failing rendering tests**

Use the public rendering seam to assert: only one concurrent claimant renders; ready rows never upload again; a failed upload leaves a recoverable pending claim; the generated PDF includes the background, QR, configured font, and snapshot value; equal snapshots produce the same stored hash.

- [ ] **Step 2: Add an atomic rendering claim**

Introduce a persisted rendering lease/token or a single conditional state transition. The renderer may proceed only after it owns the claim; it must clear the claim on retryable failure and move to `ready` only when its token matches.

- [ ] **Step 3: Render from one snapshot interface**

Split data loading, PDF construction, upload, and completion into focused functions. The renderer receives only `CertificateRenderSnapshot` and returns `{ pdf, sha256 }`; database and R2 coordination remain outside that pure rendering unit.

- [ ] **Step 4: Queue email only after ready**

Have delivery enqueue `email.certificate-issued` only when the rendering claim completed the artifact, while preserving idempotency for a recovered worker.

- [ ] **Step 5: Run focused and integration tests**

Run: `bun test src/features/certificates/rendering.test.ts src/features/outbox/delivery.test.ts && bun run test:certificates:integration`

Expected: PASS.

### Task 5: Rebuild certificate authoring with shadcn

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Modify: `src/features/admin/actions.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Cover disabled publish without a saved draft, issuer prerequisite message, pending save state, inline validation error, successful save toast, crop selection preview, long/short preview values, and a disabled course-publication button with an explanation when no content draft exists.

- [ ] **Step 2: Compose the editor from existing primitives**

Use `Card` composition for sections, `FieldGroup`/`Field`/`FieldLabel` for inputs, `Switch` for field visibility, `Slider` for position and dimension, `Select` for alignment/font, `Input` for color/size, `Alert` for requirements, `Separator` for boundaries, and Sonner for action feedback.

- [ ] **Step 3: Make preview faithful and local-first**

Display the selected crop through an object URL before persistence. Render the same typography, color, alignment, boxes, QR data URL, signature image, and long/short values used by the PDF contract.

- [ ] **Step 4: Return typed action outcomes**

Replace expected state errors with `{ status, message, fieldErrors }`. Server Actions keep unexpected failures as errors but normal prerequisites never yield HTTP 500.

- [ ] **Step 5: Run component tests**

Run: `bun test src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

Expected: PASS.

### Task 6: Document and verify the complete flow

**Files:**
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/operations/outbox-and-transactional-effects.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `.env.example`
- Modify: `tests/e2e/critical-journeys.spec.ts`

- [ ] **Step 1: Correct the canonical contracts**

Document the rendering claim, issuer and image prerequisites, private asset lifecycle, exact outbox topic sequence, and forward-only migration recovery.

- [ ] **Step 2: Extend end-to-end coverage**

Verify Admin cannot publish prematurely, can crop/save/publish a template, the student sees preparing then ready state, and public validation never exposes a PDF.

- [ ] **Step 3: Run the release gates**

Run: `bun run docs:check && bun run db:migrations:check && bun run test && bun run typecheck && bun run check && bun run build && bun run test:e2e`

Expected: every command exits 0.
