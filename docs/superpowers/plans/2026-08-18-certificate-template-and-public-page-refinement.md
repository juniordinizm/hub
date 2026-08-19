# Certificate Template and Public Page Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make certificate rendering honor the published template exactly, warn about intentional clipping before publication, and redesign the public verification page around a premium, trustworthy hierarchy aligned with the Hub design system.

**Architecture:** Keep the certificate snapshot and PDF renderer authoritative: configured geometry and typography are passed unchanged to PDFKit, whose bounded text box preserves intentional clipping. The editor receives overflow fields from its existing preview measurement and surfaces a non-blocking warning plus a publish-only confirmation. The public route remains server-rendered and rate-limited, but its composition is split into verification header, status, document preview, claims and actions without changing the storage or public-PDF contract.

**Tech Stack:** Next.js App Router, React 19, TypeScript, shadcn/ui primitives, Tailwind tokens, PDFKit, Vitest, existing certificate and R2 route contracts.

---

### Task 1: Restore exact template rendering semantics

**Files:**
- Modify: `src/features/certificates/rendering.ts`
- Test: `src/features/certificates/rendering-fields.test.ts`
- Modify: `docs/adr/0006-certificate-lifecycle.md`
- Modify: `docs/domain/certificates-and-data-rights.md`

- [ ] **Step 1: Write the failing contract test**

Replace the current auto-fit expectation with a public-renderer contract that uses a configured `fontSize: 30`, a short field height, and a document mock whose measured height is larger than the field. Assert that rendering resolves, the configured font size is used, and `document.text` receives the configured `height` and `width`; retain a separate test proving PDFKit failures are still surfaced.

```ts
it("keeps configured typography and bounds when text exceeds the field", async () => {
  const document = createMockDocument();
  document.heightOfString = vi.fn(() => 40);
  dependencies.createCertificatePdfDocument.mockReturnValueOnce(document);
  const result = await renderCertificatePdf({
    background,
    publicBaseUrl: "https://hub.example.test",
    signature: null,
    snapshot: studentNameSnapshot,
  });

  expect(result.pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(document.fontSize).toHaveBeenCalledWith(30);
  expect(document.text).toHaveBeenCalledWith(
    "Aluna com nome comprido",
    expect.any(Number),
    expect.any(Number),
    expect.objectContaining({ height: expect.any(Number), width: expect.any(Number) })
  );
});
```

- [ ] **Step 2: Run the focused test and verify the old auto-fit behavior fails the contract**

Run `bun run test -- src/features/certificates/rendering-fields.test.ts`.

Expected: the current implementation fails because it reduces the configured font or throws `certificate_field_overflow` instead of preserving the configured value.

- [ ] **Step 3: Remove renderer-side auto-fit and overflow rejection**

In `rendering.ts`, remove `MIN_RENDER_FONT_SIZE`, `RENDER_FONT_SIZE_STEP`, `fitTextToField`, and the height measurement/throw. For every visible text field, call `document.font(field.font ?? "Helvetica").fontSize(field.fontSize)` once and pass the existing bounded `height` and `width` to `document.text`. Keep QR/signature branches unchanged.

- [ ] **Step 4: Run the focused rendering tests**

Run `bun run test -- src/features/certificates/rendering-fields.test.ts src/features/certificates/rendering.test.ts`.

Expected: all rendering tests pass, including intentional clipping and PDF output.

- [ ] **Step 5: Align the certificate contracts**

Replace the previous documentation statement that the worker shrinks text with: the renderer honors the published geometry and typography exactly; the editor warns before save/publish when sample text exceeds a field; the resulting PDF keeps the configured bounds and may clip content by design. Run `bun run docs:check`.

### Task 2: Warn about clipping and confirm only publication

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-overflow-notice.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Add the user-visible warning test**

Extend the editor test fixture so the preview reports `studentName` as overflowing, then assert that the editor renders an accessible warning containing the field label, says that the PDF keeps the current crop, and leaves `Salvar rascunho` enabled.

```ts
expect(container.querySelector('[data-certificate-overflow-warning="true"]')).not.toBeNull();
expect(container.textContent).toContain("Nome da aluna");
expect(container.textContent).toContain("o PDF manterá o recorte atual");
expect(saveButton?.disabled).toBe(false);
```

- [ ] **Step 2: Add the publish-confirmation test**

With the same reported overflow, click `Salvar e publicar`; assert that no publish action runs before confirmation, the AlertDialog explains that clipping is intentional, then confirm and assert the original FormData reaches `publishCertificateTemplateFormAction`. Render the same editor without overflow and assert publication proceeds without a dialog.

- [ ] **Step 3: Expose preview overflow through a typed callback**

Add `onOverflowFieldsChange?: (fields: CertificateField[]) => void` to `CertificateTemplatePreview`. Reuse the existing `overflowFields` measurement and `overflowFieldLabels` projection, call the callback whenever the measured set changes, and do not disable or mutate any field. Preserve the short/long sample toggle so the warning reflects the currently visible sample.

- [ ] **Step 4: Render the compact warning component**

Create `CertificateTemplateOverflowNotice` using the existing shadcn `Alert`, `AlertTitle`, and `AlertDescription`. It must use `data-certificate-overflow-warning="true"`, `role="status"`, and `aria-live="polite"`; list the affected labels, explain that the PDF will preserve the configured crop, and point to the field inspector/`Ajustar tamanho ao conteúdo` as optional manual corrections. It must not disable save or publish by itself.

- [ ] **Step 5: Add publish-only confirmation state**

In `CertificateTemplateForm`, keep the reported overflow fields in state. Wrap the publish form action with a handler that stores the prepared `FormData` and opens an `AlertDialog` only when overflow exists. The dialog copy must explain the irreversible scope: future PDFs keep the configured crop; existing certificates remain immutable. Draft save stays direct. Confirming calls the existing publish action with the stored FormData; cancelling clears it without changing the template.

- [ ] **Step 6: Run editor tests and lint**

Run `bun run test -- src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`, then `bun run typecheck` and `bun x ultracite check`.

Expected: warning/confirmation tests and all existing editor interactions pass; no disabled save/publish regression appears.

### Task 3: Recompose the public verification page

**Files:**
- Modify: `src/app/certificados/[code]/page.tsx`
- Modify: `src/app/certificados/[code]/certificate-public-actions.tsx`
- Create: `src/app/certificados/[code]/certificate-public-code.tsx`
- Create: `src/app/certificados/[code]/certificate-public-status.tsx`
- Test: `src/app/certificados/[code]/page.test.tsx`

- [ ] **Step 1: Add markup-contract tests for the approved hierarchy**

Extend the public page tests to require:

```ts
expect(markup).toContain("Verificação de certificado");
expect(markup).toContain("Certificado emitido em nome de");
expect(markup).toContain('data-certificate-status="valid"');
expect(markup).toContain('data-certificate-document="true"');
expect(markup).toContain('data-certificate-claims="true"');
expect(markup).toContain("Código do certificado");
```

Also assert that pending, failed and revoked states keep the status banner and claims but never render the document frame or download action.

- [ ] **Step 2: Extract status and claims presentation**

Create `CertificatePublicStatus` with explicit `valid`, `pending`, `failed`, and `revoked` presentation using existing status tokens and `aria-live` only for dynamic status messages. Create `CertificatePublicCode` to render only the public code below the document, marked with `translate="no"` and `font-mono`; issuer, CNPJ, dates, workload and enrollment metadata must not be repeated in the HTML.

- [ ] **Step 3: Rebuild the server page hierarchy**

Keep rate limiting, `notFound`, metadata, status gating, canonical PDF href, and server data unchanged. Compose the page as:

```tsx
<PageContainer className="...">
  <Card className="...">
    <CertificatePublicHeader />
    <CertificatePublicStatus ... />
    <CertificatePublicSummary ... />
    {isReady ? <CertificatePublicDocument ... /> : null}
    <CertificatePublicCode ... />
    {isReady ? <CertificatePublicActions ... /> : null}
  </Card>
</PageContainer>
```

Use the Hub's existing dark tokens, `max-w-4xl`, restrained borders, and semantic teal/amber/destructive accents. Keep the PDF iframe but place it in an A4-ratio, paper-toned frame with bounded height so the native viewer's black area does not dominate the page. Do not add a new PDF.js dependency or storage preview pipeline in this slice.

- [ ] **Step 4: Refine public actions**

Keep `Baixar PDF` as the primary anchor and `Copiar link` as the secondary button. Add visible icon labels only where an icon is used, keep the existing live region, and ensure the action row wraps cleanly on narrow screens. Keep the canonical public URL and encoded code behavior unchanged.

- [ ] **Step 5: Run public page tests**

Run `bun run test -- src/app/certificados/[code]/page.test.tsx src/app/certificados/[code]/certificate-public-actions.test.tsx`.

Expected: valid page has the new hierarchy and actions; pending/failed/revoked pages have explicit status and claims without preview/download.

### Task 4: Integrated verification and handoff

**Files:**
- Modify: `docs/adr/0006-certificate-lifecycle.md`
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/architecture.md` only if the public presentation boundary changes

- [ ] **Step 1: Run focused regression suites**

Run rendering, editor, public page, certificate-card, and public-route tests together. Expected: all pass with no snapshot or contract drift.

- [ ] **Step 2: Run project gates**

Run `bun run verify`, `bun run docs:check`, and `git diff --check`. Expected: typecheck, Ultracite, 1,823+ Vitest tests, Next build, Knip, docs and migrations pass.

- [ ] **Step 3: Re-test the live development certificate**

Use the existing local dev server and ngrok endpoint. Confirm that a deliberately overflowing template still produces a PDF with the configured size, the editor warning is visible, publish confirmation appears only when needed, and the public page returns the same status/document hierarchy.

- [ ] **Step 4: Review the diff and leave integration explicit**

Confirm only the renderer/editor/public-page/docs files are changed, preserve unrelated worktree edits, and report that no merge, push, or deploy occurred unless separately authorized.
