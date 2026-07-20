import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDocumentation } from "../../scripts/check-docs";

const VERIFIED_COMMIT = "888ad2f8addddef9dec4f11bacad8580ffb7181b";

const writeProjectFile = (
  rootDirectory: string,
  relativePath: string,
  content: string
): void => {
  const absolutePath = join(rootDirectory, relativePath);
  mkdirSync(join(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, content);
};

const liveDocument = (body: string): string => `---
status: canonical
owner: engineering
last_verified_commit: ${VERIFIED_COMMIT}
---

${body}
`;

describe("validateDocumentation", () => {
  it("accepts metadata, links, unique IDs, a valid commit and covered environment variables", () => {
    const rootDirectory = mkdtempSync(join(tmpdir(), "hub-docs-valid-"));

    writeProjectFile(rootDirectory, ".env.example", "DATABASE_URL=\n");
    writeProjectFile(
      rootDirectory,
      "README.md",
      liveDocument(
        "# Hub\n\n[Ambiente](docs/operations/environment.md)\n\nOrigem: `README.md`."
      )
    );
    writeProjectFile(
      rootDirectory,
      "docs/operations/environment.md",
      liveDocument(
        "# Ambiente\n\n### REG-OPS-001 Configuração\n\n`DATABASE_URL`"
      )
    );

    const errors = validateDocumentation({
      rootDirectory,
      documentPaths: ["README.md", "docs/operations/environment.md"],
      environmentDocumentPath: "docs/operations/environment.md",
      migrationLedgerDocumentPath: "README.md",
      migratedOriginalDocumentPaths: ["README.md"],
      removedDocumentPaths: [],
      commitExists: (commit) => commit === VERIFIED_COMMIT,
    });

    expect(errors).toEqual([]);
  });

  it("reports every contractual documentation failure", () => {
    const rootDirectory = mkdtempSync(join(tmpdir(), "hub-docs-invalid-"));

    writeProjectFile(
      rootDirectory,
      ".env.example",
      "DATABASE_URL=\nRESEND_API_KEY=\n"
    );
    writeProjectFile(
      rootDirectory,
      "README.md",
      `---
status: canonical
last_verified_commit: not-a-commit
---

# Hub

[Ausente](docs/missing.md)

Consulte docs/old-plan.md.

### REG-DUP-001 Primeira definição
`
    );
    writeProjectFile(
      rootDirectory,
      "docs/operations/environment.md",
      liveDocument(
        "# Ambiente\n\n### REG-DUP-001 Segunda definição\n\n`DATABASE_URL`"
      )
    );
    writeProjectFile(
      rootDirectory,
      "docs/ledger.md",
      liveDocument("# Registro\n\nOrigem: `README.md`.")
    );

    const errors = validateDocumentation({
      rootDirectory,
      documentPaths: [
        "README.md",
        "docs/operations/environment.md",
        "docs/ledger.md",
      ],
      environmentDocumentPath: "docs/operations/environment.md",
      removedDocumentPaths: ["docs/old-plan.md"],
      migrationLedgerDocumentPath: "docs/ledger.md",
      migratedOriginalDocumentPaths: [
        "README.md",
        "docs/not-listed-in-migration.md",
      ],
      commitExists: () => false,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("owner"),
        expect.stringContaining("docs/missing.md"),
        expect.stringContaining("REG-DUP-001"),
        expect.stringContaining("not-a-commit"),
        expect.stringContaining("docs/old-plan.md"),
        expect.stringContaining("docs/not-listed-in-migration.md"),
        expect.stringContaining("RESEND_API_KEY"),
      ])
    );
  });
});
