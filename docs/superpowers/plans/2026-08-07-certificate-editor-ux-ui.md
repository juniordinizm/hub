# Certificate Editor UX/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir sobreposições intencionais no editor de certificado, comunicar o risco sem bloqueio e melhorar feedback, acessibilidade e proteção contra perda de alterações.

**Architecture:** Separar validação estrutural de diagnósticos advisory em `template-rules.ts`. O editor calcula os diagnósticos a partir do mesmo `CertificateTemplateSpec`, mostra texto acessível e marca os retângulos envolvidos no preview. O fluxo de ações continua persistindo pelo servidor; apenas erros estruturais impedem a operação.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Testing Library, Radix Accordion, componentes UI locais, Ultracite/Biome.

---

### Task 1: Registrar o contrato de diagnóstico de sobreposição

**Files:**
- Modify: `src/features/certificates/template-rules.ts`
- Test: `src/features/certificates/template-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Adicionar testes que exercitem as interfaces públicas. Antes deles, defina no
arquivo de teste `makeRequiredFields`, que retorna os cinco campos obrigatórios
com valores válidos e aplica apenas os overrides de geometria/visibilidade
recebidos no argumento:

```ts
it("reports overlapping visible fields without making validation fail", () => {
  const fields = makeRequiredFields({
    studentName: { x: 0, y: 0, width: 40, height: 10 },
    courseTitle: { x: 20, y: 0, width: 40, height: 10 },
  });
  const spec = { backgroundKey: "certificates/a4.png", fields };

  expect(findCertificateTemplateOverlaps(fields)).toEqual([
    { fields: ["studentName", "courseTitle"] },
  ]);
  expect(validateCertificateTemplate(spec)).not.toContain(
    "Os campos studentName e courseTitle se sobrepoem."
  );
});

it("ignores hidden fields when reporting overlaps", () => {
  const fields = makeRequiredFields({
    studentName: { x: 0, y: 0, width: 40, height: 10 },
    courseTitle: { x: 20, y: 0, width: 40, height: 10, visible: false },
  });

  expect(findCertificateTemplateOverlaps(fields)).toEqual([]);
});
```

Use uma fábrica de teste com valores válidos e expectativas literais; não recomputar a geometria no `expect`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `bunx vitest run src/features/certificates/template-rules.test.ts`.
Expected: FAIL because `findCertificateTemplateOverlaps` is not exported and the current validator still returns the overlap string.

- [ ] **Step 3: Implement the smallest rule change**

Export um tipo estruturado e uma função `findCertificateTemplateOverlaps(fields)` que filtre `visible`, compare retângulos e retorne pares na ordem do array. Remover a chamada de sobreposição de `validateCertificateTemplate`; manter nessa função todos os erros estruturais atuais. Não remover a lógica geométrica nem alterar o formato persistido.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `bunx vitest run src/features/certificates/template-rules.test.ts`.
Expected: PASS, incluindo os testes existentes de área, duplicidade, obrigatoriedade, fonte, cor e tamanho.

### Task 2: Provar que o servidor persiste templates sobrepostos

**Files:**
- Modify: `src/features/certificates/templates.test.ts`
- Verify: `src/features/certificates/templates.ts`

- [ ] **Step 1: Write the failing behavior test**

Adicionar um caso à suíte de serialização usando uma especificação com `studentName` e `courseTitle` sobrepostos, mockando o pool como nos testes existentes, e afirmar que `saveCertificateTemplateDraft` resolve com as chaves substituídas e chega ao `commit`.

- [ ] **Step 2: Run the focused test**

Run `bunx vitest run src/features/certificates/templates.test.ts`.
Expected before implementation: FAIL because `saveCertificateTemplateDraft` receives the overlap as the first domain error.

- [ ] **Step 3: Implement only the server contract adjustment**

Keep `saveCertificateTemplateDraft` calling `validateCertificateTemplate`; since overlap is no longer part of that result, no action-specific bypass or duplicated server rule is needed. Preserve transaction locking, asset cleanup and audit logging.

- [ ] **Step 4: Run the focused test**

Run `bunx vitest run src/features/certificates/templates.test.ts`.
Expected: PASS with the original transaction assertions intact.

### Task 3: Exibir diagnóstico acessível e estados de ação no editor

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-overlap-notice.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Cover the user-visible seam:

```tsx
it("allows saving a template with overlapping fields and announces the decision", async () => {
  render(<CertificateTemplateEditor certificateEnabled courseId="course-1" issuerConfigured templates={[overlappingTemplate]} />);

  expect(screen.getByText(/sobreposições detectadas/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /salvar rascunho/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /salvar e publicar/i })).toBeEnabled();
  expect(screen.getByText(/não impede salvar ou publicar/i)).toBeInTheDocument();
});

it("shows human-readable overlap pairs", () => {
  render(<CertificateTemplateEditor certificateEnabled courseId="course-1" issuerConfigured templates={[overlappingTemplate]} />);

  expect(screen.getByText(/Nome da aluna.*Curso/i)).toBeInTheDocument();
});
```

Also assert that loading labels use `…` and that the accordion trigger exposes a `focus-visible` class in the rendered DOM.

- [ ] **Step 2: Run the focused editor tests and verify the new assertions fail**

Run `bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"`.
Expected: FAIL because the editor has no overlap notice and the existing action state uses `...`.

- [ ] **Step 3: Implement the notice and preview diagnostics**

Create a small presentational notice that accepts structured overlaps and a field-label map, renders an advisory `role="status"` with `aria-live="polite"`, lists each pair, and states that saving/publication remain allowed. Compute overlaps from the memoized `spec` in the form and render the notice below the preview/error region.

Pass the set of involved field names to `CertificateTemplatePreview`; apply a non-color-only outline/background marker and a stable `data-overlap="true"` attribute to each affected frame. Keep the actual content and QR/signature rendering unchanged.

- [ ] **Step 4: Implement action and keyboard refinements**

Change action text to `Salvando…` and `Publicando…`. Add `focus-visible:ring-*` and `focus-visible:ring-offset-*` to the Radix accordion trigger instead of relying on `outline-none`. Keep submit buttons enabled until their request starts; continue disabling only while saving, publishing or uploading.

- [ ] **Step 5: Run focused editor tests**

Run `bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"`.
Expected: PASS, including existing crop, signer, upload, error and keyboard tests.

### Task 4: Reorganizar a seção de assinatura sem alterar o contrato

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write the failing accessibility/structure test**

Assert that the signer name and role inputs are grouped under a single visible “Assinatura” section and retain their existing names/values; assert that the `signerRole` item still exposes its independent position controls.

- [ ] **Step 2: Run the focused test**

Run the editor test file and confirm the new grouping assertion fails against the current “Responsável”/“Cargo do responsável” arrangement.

- [ ] **Step 3: Implement the smallest information-architecture change**

Use the existing accordion item for the combined signature metadata and upload controls. Make its title “Assinatura” while preserving the `signerName` and `signerRole` field keys, hidden form values, position controls and upload callbacks. Keep the role positioning item explicitly labeled “Cargo do responsável — posição” only if a separate item remains; otherwise render the role position controls in the same section with a clear subheading.

- [ ] **Step 4: Run the focused editor tests**

Run the editor suite and confirm keyboard navigation, input values and signature upload behavior remain green.

### Task 5: Protect unsaved edits and improve error recovery

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [ ] **Step 1: Write the failing browser-behavior test**

Render `<CertificateTemplateEditor certificateEnabled courseId="course-1" issuerConfigured templates={[draftTemplate]} />`, toggle the first `[role="switch"]`, dispatch a cancelable `beforeunload` event, and assert `event.defaultPrevented` is true. Unmount between cases and verify a clean template does not prevent navigation.

- [ ] **Step 2: Run the focused test**

Run the editor test file. Expected: FAIL because `isDirty` currently only renders a badge.

- [ ] **Step 3: Implement the guard and copy**

Add a `useEffect` depending on `isDirty` that registers a `beforeunload` listener only while dirty and removes it on cleanup. Do not add a custom router monkey-patch. Keep the existing success path clearing dirty state. Change the badge to “Alterações não salvas” and ensure structural error copy includes the next action when the server returns a message.

- [ ] **Step 4: Run focused tests**

Run the editor suite and the relevant action tests. Expected: PASS with no listener leak between tests.

### Task 6: Documentation and full verification

**Files:**
- Modify: `docs/domain/certificates-and-data-rights.md`
- Verify: `docs/superpowers/specs/2026-08-07-certificate-editor-ux-ui-design.md`
- Verify: `docs/superpowers/plans/2026-08-07-certificate-editor-ux-ui.md`

- [ ] **Step 1: Update the canonical domain rule**

Document that geometric overlaps are advisory and may be intentionally published; list the structural constraints that remain blocking and the editor warning behavior.

- [ ] **Step 2: Run documentation validation**

Run `bun run docs:check`.
Expected: PASS.

- [ ] **Step 3: Run narrow checks**

Run `bunx vitest run src/features/certificates/template-rules.test.ts src/features/certificates/templates.test.ts "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"`.
Expected: PASS.

- [ ] **Step 4: Run repository checks**

Run `bun x ultracite check`, `bun run typecheck`, `bun run test`, and `bun run build`.
Expected: all commands pass; if a check fails, fix the cause before reporting completion.
