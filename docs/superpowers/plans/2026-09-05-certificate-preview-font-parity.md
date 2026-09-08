# Certificate Preview Font Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new certificate PDFs, server-generated PNG previews, and the administrative certificate preview use the same deterministic Inter Regular/Bold font without depending on system fonts or changing preview integrity validation.

**Architecture:** Keep the persisted logical font values `Helvetica` and `Helvetica-Bold` for backward compatibility, but resolve both through one certificate-font module to Inter font files. PDFKit will embed those files; Sharp/librsvg will resolve the same files through a bundled Fontconfig configuration; the browser editor will load the same files locally without changing the product-wide font. Existing preview objects and test certificates will not be backfilled or semantically revalidated.

**Tech Stack:** TypeScript, Next.js 16 App Router, PDFKit, Sharp 0.35.3/librsvg, Fontconfig, Vitest, CSS `@font-face`, Vercel Node.js Functions, Bun.

---

## File map

Create:

- `public/fonts/certificates/Inter-Regular.ttf`: Inter static weight 400 from the official Inter distribution.
- `public/fonts/certificates/Inter-Bold.ttf`: Inter static weight 700 from the official Inter distribution.
- `public/fonts/certificates/OFL.txt`: unmodified SIL Open Font License 1.1 text distributed with Inter.
- `public/fonts/certificates/fonts.conf`: minimal Fontconfig configuration with a relative font directory and writable `/tmp` cache.
- `src/features/certificates/font-assets.ts`: one server-side source of truth for font paths, logical aliases, Fontconfig setup, and family name.
- `src/features/certificates/font-assets.test.ts`: asset existence, alias, and runtime-configuration contract tests.

Modify:

- `src/features/certificates/rendering.ts`: resolve `Helvetica` aliases to Inter font files before PDFKit text rendering.
- `src/features/certificates/rendering-fields.test.ts`: assert PDFKit receives the Inter file for regular and bold logical fields.
- `src/features/certificates/preview.ts`: configure bundled Fontconfig, emit the Inter family in SVG, and expose a narrow SVG seam for deterministic assertions.
- `src/features/certificates/preview.test.ts`: cover accented text, Inter SVG output, PNG dimensions, and integrity hash.
- `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.ts`: use the locally loaded certificate font family in the editor preview.
- `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`: update the expected family and preserve typography/geometry assertions.
- `src/app/globals.css`: define certificate-specific local `@font-face` declarations pointing at the public Inter files; do not change `body` or `--font-sans`.
- `next.config.ts`: trace the certificate font/config assets into server bundles.
- `src/vercel-config.test.ts`: assert Sharp, PDFKit, and certificate-font assets are traced.
- `src/app/certificados/[code]/preview/route.ts`: explicitly keep the Sharp preview route on the Node.js runtime if it is not already inferred by the project contract.
- `docs/domain/certificates-and-data-rights.md`: document deterministic Inter font assets, PDF/PNG parity, and no backfill of existing test previews.
- `docs/adr/0006-certificate-lifecycle.md`: record that future PDF and PNG rendering consumes the same embedded font assets while historical artifacts remain immutable.

No schema, migration, certificate row, preview hash, storage key, public route contract, or R2 verification change is planned.

### Task 1: Add the failing font asset contract

**Files:**
- Create: `src/features/certificates/font-assets.test.ts`
- Create: `src/features/certificates/font-assets.ts`

- [ ] **Step 1: Write the failing asset and alias tests**

Create `src/features/certificates/font-assets.test.ts` with these assertions. The test must initially fail because the helper and packaged assets do not exist yet:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_FONT_FAMILY,
  CERTIFICATE_FONT_FILES,
  configureCertificateFontRuntime,
  getCertificateFontFile,
} from "./font-assets";

describe("certificate font assets", () => {
  it("ships both static Inter weights and the Fontconfig file", () => {
    expect(existsSync(CERTIFICATE_FONT_FILES.regular)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.bold)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.config)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.license)).toBe(true);
  });

  it("keeps the persisted aliases mapped to the correct Inter files", () => {
    expect(CERTIFICATE_FONT_FAMILY).toBe("Inter");
    expect(getCertificateFontFile("Helvetica")).toBe(
      CERTIFICATE_FONT_FILES.regular
    );
    expect(getCertificateFontFile("Helvetica-Bold")).toBe(
      CERTIFICATE_FONT_FILES.bold
    );
    expect(getCertificateFontFile(undefined)).toBe(
      CERTIFICATE_FONT_FILES.regular
    );
  });

  it("configures Fontconfig from the bundled certificate assets", () => {
    configureCertificateFontRuntime();
    expect(process.env.FONTCONFIG_FILE).toBe(CERTIFICATE_FONT_FILES.config);
    expect(process.env.FONTCONFIG_PATH).toBe(CERTIFICATE_FONT_FILES.directory);
    expect(readFileSync(CERTIFICATE_FONT_FILES.config, "utf8")).toContain(
      'prefix="relative"'
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify the expected RED result**

Run:

```text
bun run test -- src/features/certificates/font-assets.test.ts
```

Expected: FAIL because `font-assets.ts` and the four packaged assets do not exist.

### Task 2: Add the licensed Inter assets and central helper

**Files:**
- Create: `public/fonts/certificates/Inter-Regular.ttf`
- Create: `public/fonts/certificates/Inter-Bold.ttf`
- Create: `public/fonts/certificates/OFL.txt`
- Create: `public/fonts/certificates/fonts.conf`
- Create: `src/features/certificates/font-assets.ts`

- [ ] **Step 1: Pin and download the official static Inter files**

Use the official Inter distribution linked from the `rsms/inter` repository, pin the release used by the implementation (Inter 4.1), and copy only the static Regular and Bold TTF files into `public/fonts/certificates/`. Do not download from a CDN or from a system-font directory.

Verify the downloaded files with:

```powershell
Get-FileHash public/fonts/certificates/Inter-Regular.ttf -Algorithm SHA256
Get-FileHash public/fonts/certificates/Inter-Bold.ttf -Algorithm SHA256
```

Record the source release and both hashes in the implementation commit or the adjacent certificate-font documentation; do not alter the font binaries.

- [ ] **Step 2: Add the license and minimal Fontconfig file**

Copy the unmodified OFL 1.1 license distributed by Inter to `OFL.txt`. Add this exact configuration to `fonts.conf`:

```xml
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir prefix="relative">.</dir>
  <cachedir>/tmp/certificate-fontconfig</cachedir>
</fontconfig>
```

The relative directory makes Fontconfig scan the directory containing this file; the cache is writable in a Vercel Function and does not become application state.

- [ ] **Step 3: Implement the path and alias helper**

Create `src/features/certificates/font-assets.ts` with this contract. Resolve from `process.cwd()` because the project already copies `public/` into standalone output and the Vercel build must read the same path at runtime:

```ts
import { resolve } from "node:path";
import type { CertificateTemplateField } from "./template-rules";

const certificateFontDirectory = resolve(
  process.cwd(),
  "public/fonts/certificates"
);

export const CERTIFICATE_FONT_FAMILY = "Inter" as const;

export const CERTIFICATE_FONT_FILES = {
  bold: resolve(certificateFontDirectory, "Inter-Bold.ttf"),
  config: resolve(certificateFontDirectory, "fonts.conf"),
  directory: certificateFontDirectory,
  license: resolve(certificateFontDirectory, "OFL.txt"),
  regular: resolve(certificateFontDirectory, "Inter-Regular.ttf"),
} as const;

export const getCertificateFontFile = (
  font: CertificateTemplateField["font"]
): string =>
  font === "Helvetica-Bold"
    ? CERTIFICATE_FONT_FILES.bold
    : CERTIFICATE_FONT_FILES.regular;

export const configureCertificateFontRuntime = (): void => {
  process.env.FONTCONFIG_FILE = CERTIFICATE_FONT_FILES.config;
  process.env.FONTCONFIG_PATH = CERTIFICATE_FONT_FILES.directory;
};
```

- [ ] **Step 4: Run the asset contract tests**

Run:

```text
bun run test -- src/features/certificates/font-assets.test.ts
```

Expected: PASS with all asset, alias, and Fontconfig assertions green.

### Task 3: Use Inter in the PDF renderer

**Files:**
- Modify: `src/features/certificates/rendering.ts:124-126`
- Test: `src/features/certificates/rendering-fields.test.ts`

- [ ] **Step 1: Add a failing assertion for the real font file**

Import `CERTIFICATE_FONT_FILES` into `rendering-fields.test.ts`, render a regular `signerRole` field and a bold `studentName` field with the existing mock document, then assert:

```ts
expect(document.font).toHaveBeenCalledWith(CERTIFICATE_FONT_FILES.regular);
expect(document.font).toHaveBeenCalledWith(CERTIFICATE_FONT_FILES.bold);
```

Run:

```text
bun run test -- src/features/certificates/rendering-fields.test.ts
```

Expected: FAIL because the renderer currently calls `document.font("Helvetica")` and `document.font("Helvetica-Bold")`.

- [ ] **Step 2: Resolve the logical alias before PDFKit renders text**

In `rendering.ts`, import `getCertificateFontFile` and replace:

```ts
document.font(field.font ?? "Helvetica").fontSize(field.fontSize);
```

with:

```ts
document.font(getCertificateFontFile(field.font)).fontSize(field.fontSize);
```

Do not change the snapshot schema, coordinates, clipping, `heightOfString`, QR, signature, or hash calculation.

- [ ] **Step 3: Run PDF renderer tests**

Run:

```text
bun run test -- src/features/certificates/rendering-fields.test.ts src/features/certificates/rendering.test.ts
```

Expected: PASS; the generated PDF remains valid and the mock confirms that both weights use Inter files.

### Task 4: Make the PNG renderer deterministic with the same Inter files

**Files:**
- Modify: `src/features/certificates/preview.ts:1-16,80-124,179-201`
- Test: `src/features/certificates/preview.test.ts`

- [ ] **Step 1: Add the red-capable SVG/font assertions**

Export a narrow pure helper named `createCertificatePreviewSvg` that receives the existing QR/signature data URLs and snapshot. Add a test asserting that a sample with `Ação`, `João`, and `Responsável` contains:

```ts
expect(svg).toContain('font-family="Inter"');
expect(svg).toContain('font-weight="700"');
expect(svg).not.toContain('Helvetica, Arial, sans-serif');
expect(svg).toContain("Ação");
```

Also add a render test that calls `configureCertificateFontRuntime()` through `renderCertificatePreview`, checks the PNG signature, `1200x848` dimensions, SHA-256 format, and a non-empty ink region for the accented text.

Run:

```text
bun run test -- src/features/certificates/preview.test.ts
```

Expected: the SVG assertion fails before the production change because the current renderer emits `Helvetica, Arial, sans-serif`.

- [ ] **Step 2: Configure the bundled Fontconfig before Sharp rasterization**

At the start of `renderCertificatePreview`, call `configureCertificateFontRuntime()` before the first Sharp operation. Replace the SVG family declaration with:

```xml
font-family="Inter"
```

Keep `font-weight="400"` and `font-weight="700"` as the only supported weights. Do not add a system fallback to the server SVG: a fallback would hide missing-asset failures and could recreate PDF/PNG divergence.

- [ ] **Step 3: Preserve the existing image pipeline**

Keep these properties unchanged:

- `PREVIEW_WIDTH = 1200`;
- `PREVIEW_HEIGHT = 848`;
- Sharp resize with `fit: "fill"` for the existing A4 contract;
- SVG compositing over the background;
- QR `preserveAspectRatio="none"`;
- signature `preserveAspectRatio="xMidYMid meet"`;
- PNG output and SHA-256 calculation;
- R2 object key and `preview_sha256` update.

- [ ] **Step 4: Run the preview tests**

Run:

```text
bun run test -- src/features/certificates/font-assets.test.ts src/features/certificates/preview.test.ts src/features/certificates/preview-server.test.ts src/app/certificados/[code]/preview/route.test.ts
```

Expected: all focused tests pass and no Fontconfig warning is emitted locally when the bundled configuration is selected.

### Task 5: Align the administrative browser preview without changing global typography

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts`

- [ ] **Step 1: Define certificate-only local font faces**

Add these declarations to `src/app/globals.css` without changing the existing body or `--font-sans` declarations:

```css
@font-face {
  font-family: "Certificate Inter";
  src: url("/fonts/certificates/Inter-Regular.ttf") format("truetype");
  font-display: swap;
  font-style: normal;
  font-weight: 400;
}

@font-face {
  font-family: "Certificate Inter";
  src: url("/fonts/certificates/Inter-Bold.ttf") format("truetype");
  font-display: swap;
  font-style: normal;
  font-weight: 700;
}
```

- [ ] **Step 2: Use the certificate font in the preview style**

Change `getCertificatePreviewTextStyle` so its `fontFamily` is:

```ts
  fontFamily: "Certificate Inter, sans-serif",
```

Do not change the existing point-to-pixel conversion, line height, flex alignment, field frame, clipping, or overflow measurement.

- [ ] **Step 3: Update the focused layout assertion**

Change the test expectation from `Helvetica, Arial, sans-serif` to the certificate variable family while preserving the existing assertions for weight, size, alignment, and normalized geometry.

- [ ] **Step 4: Run the editor layout tests**

Run:

```text
bun run test -- src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts
```

Expected: PASS, with no change to global site typography.

### Task 6: Trace assets and keep the preview on Node.js

**Files:**
- Modify: `next.config.ts:110-112`
- Modify: `src/vercel-config.test.ts`
- Modify: `src/app/certificados/[code]/preview/route.ts`
- Test: `src/vercel-config.test.ts`

- [ ] **Step 1: Add the font directory to output tracing**

Extend the existing `outputFileTracingIncludes["/*"]` list with:

```ts
"public/fonts/certificates/**/*"
```

Keep the existing Sharp and `@img/sharp-*` entries unchanged.

- [ ] **Step 2: Make the runtime explicit**

Add this route declaration at the top level of `src/app/certificados/[code]/preview/route.ts`:

```ts
export const runtime = "nodejs";
```

This prevents an accidental Edge migration of a route that uses Sharp, Fontconfig, filesystem paths, and R2/database server code.

- [ ] **Step 3: Add Vercel contract assertions**

Extend `src/vercel-config.test.ts` to assert the font asset tracing entry and the preview route’s explicit Node runtime. Keep the existing PDFKit and Sharp tracing tests.

- [ ] **Step 4: Build and inspect the standalone artifact**

Run:

```text
bun run build
```

Then verify these files exist in the build output used by the local standalone server:

```text
.next/standalone/public/fonts/certificates/Inter-Regular.ttf
.next/standalone/public/fonts/certificates/Inter-Bold.ttf
.next/standalone/public/fonts/certificates/fonts.conf
```

Expected: all three files exist and the build exits 0.

### Task 7: Document the runtime contract and verify the complete change

**Files:**
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/adr/0006-certificate-lifecycle.md`

- [ ] **Step 1: Document the deterministic font contract**

Record that future PDF and PNG renderers use the same bundled Inter Regular/Bold assets, that the logical template aliases remain backward-compatible, that the preview uses Sharp/Fontconfig on Node.js, and that existing test previews are not backfilled.

- [ ] **Step 2: Run focused checks**

Run:

```text
bun run test -- src/features/certificates/font-assets.test.ts src/features/certificates/preview.test.ts src/features/certificates/preview-server.test.ts src/features/certificates/rendering-fields.test.ts src/features/certificates/rendering.test.ts src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.test.ts src/app/certificados/[code]/preview/route.test.ts src/vercel-config.test.ts
bun run docs:check
bun x ultracite check
git diff --check
```

Expected: all focused tests pass, documentation is valid, Ultracite reports no issues, and the diff has no whitespace errors.

- [ ] **Step 3: Run the full verification gate**

Run:

```text
bun run verify
```

Expected: migrations, typecheck, lint, tests, build, documentation, and Knip all pass. No database migration or preview backfill should be part of the diff.

- [ ] **Step 4: Inspect the final diff and deployment risk**

Confirm the final diff contains only font assets/license/configuration, certificate renderer/editor changes, Vercel tracing/runtime assertions, tests, and canonical documentation. Confirm no changes to `certificates`, `preview_sha256`, R2 keys, public redirect headers, or global body typography.

Do not commit or deploy until the user explicitly requests the integration flow; the project instructions require explicit authorization for commits and deployment.
