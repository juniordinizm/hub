# Optional Certificate Title and Issuer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow certificate templates to hide the course title and issuer name while preserving both automatic values and the global issuer publication gate.

**Architecture:** Keep `courseTitle` and `issuerName` in the canonical field union, metadata, snapshot, and renderer. Change only the central structural validation list so the visibility sheet derives their new optional status automatically; document the updated contract and prove it with a focused validation test.

**Tech Stack:** TypeScript, Vitest, Next.js/React editor, Markdown project documentation, Bun.

---

## File map

- Modify `src/features/certificates/template-rules.test.ts`: add the regression case for the minimum valid visible field set.
- Modify `src/features/certificates/template-rules.ts`: remove `courseTitle` and `issuerName` from `CERTIFICATE_REQUIRED_FIELDS`.
- Modify `docs/domain/certificates-and-data-rights.md`: record that those two automatic fields are optional in the visual layout while the issuer profile remains required for publication.

No schema, migration, snapshot, renderer, issuer-profile, or arbitrary-field changes are needed.

### Task 1: Add the failing validation regression test

**Files:**
- Test: `src/features/certificates/template-rules.test.ts`

- [ ] **Step 1: Add a test that omits the two newly optional fields**

Insert this test inside `describe("certificate template rules", () => { ... })`:

```ts
  it("accepts a template without the course title or issuer name", () => {
    const requiredVisibleFields = [
      "studentName",
      "validationCode",
      "qrCode",
    ] as const;

    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: requiredVisibleFields.map((field, index) => ({
          align: "left" as const,
          color: "#000000",
          field,
          font: "Helvetica" as const,
          fontSize: 12,
          height: 4,
          visible: true,
          width: 15,
          x: index * 16,
          y: 20,
        })),
      })
    ).toEqual([]);
  });
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```text
bun test src/features/certificates/template-rules.test.ts
```

Expected result: the new test fails because the current validator still emits `O campo courseTitle e obrigatorio.` and `O campo issuerName e obrigatorio.`.

### Task 2: Remove the two fields from the required set

**Files:**
- Modify: `src/features/certificates/template-rules.ts:86-92`

- [ ] **Step 1: Keep the canonical field union unchanged**

Leave `CERTIFICATE_FIELDS` unchanged so both fields remain available to the editor and renderer.

- [ ] **Step 2: Set the required field list to the remaining three fields**

Replace the current `CERTIFICATE_REQUIRED_FIELDS` declaration with:

```ts
export const CERTIFICATE_REQUIRED_FIELDS = [
  "studentName",
  "validationCode",
  "qrCode",
] as const satisfies readonly CertificateField[];
```

Do not change `validateCertificateTemplate`, `isRequiredCertificateField`, or the issuer profile checks.

- [ ] **Step 3: Run the focused test and verify the green result**

Run:

```text
bun test src/features/certificates/template-rules.test.ts
```

Expected result: every test in the file passes, including the new regression case; invalid geometry, color, font, and absence of `studentName` remain rejected.

### Task 3: Update the canonical domain contract and verify the change

**Files:**
- Modify: `docs/domain/certificates-and-data-rights.md` near the certificate template rules.

- [ ] **Step 1: Document the new optional layout fields**

After the paragraph that describes the standardized fields, add this contract statement:

```md
No layout do template, a arte de fundo A4 e os campos de nome da Aluna,
código de validação e QR de validação são obrigatórios e devem permanecer
visíveis. Título do Curso e nome do emissor continuam disponíveis e são
preenchidos automaticamente, mas podem ser ocultados. O perfil emissor global
com razão social, marca e CNPJ continua obrigatório para publicar.
```

- [ ] **Step 2: Run the documentation check**

Run:

```text
bun run docs:check
```

Expected result: the documentation check exits with code 0.

- [ ] **Step 3: Run the final focused checks**

Run:

```text
bun test src/features/certificates/template-rules.test.ts
bun x ultracite check
git diff --check
```

Expected result: the focused test suite passes, Ultracite reports no issues, and `git diff --check` reports no whitespace errors. Do not commit or push unless explicitly requested.
