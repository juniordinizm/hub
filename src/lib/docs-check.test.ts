import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

describe("release workflow contracts", () => {
  const readWorkflow = (name: string): string =>
    readFileSync(join(process.cwd(), ".github", "workflows", name), "utf8");

  it("keeps CI provider-free with one local PostgreSQL job", () => {
    const source = readWorkflow("ci.yml");
    expect(source).toContain("branches: [main, staging]");
    expect(source).not.toContain("vercel-preview:");
    expect(source).not.toContain("vercel deploy");
    expect(source).not.toContain("NEON_CI_API_KEY");
    expect(source).toContain("services:");
    expect(source).toContain("postgres:18-alpine");
    expect(source).toContain("create database hub_integration");
    expect(source).toContain("create database hub_e2e");
  });

  it("migrates Staging after its branch changes without deploying from Actions", () => {
    const source = readWorkflow("deploy-staging.yml");
    expect(source).not.toContain("workflow_run:");
    expect(source).toContain("branches: [staging]");
    expect(source).toContain("name: vercel-staging");
    expect(source).toContain("origin/staging");
    expect(source).toContain("db:migrate:staging");
    expect(source).not.toContain("vercel deploy");
    expect(source).toContain("preview.neurocapacitar.com.br");
  });

  it("keeps Staging jobs manual and preserves the JMVStream operation", () => {
    const source = readWorkflow("run-staging-jobs.yml");
    expect(source).toContain("workflow_dispatch:");
    expect(source).not.toContain("schedule:");
    expect(source).toContain('call_job "/api/cron/jmvstream"');
    expect(source).toContain("https://preview.neurocapacitar.com.br");
    expect(source).toContain(
      ["Authorization: Bearer ", "{CRON_SECRET}"].join("$")
    );
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("--output /dev/null");
  });

  it("requires a release mode, fast-forward validation, staged deployment, and smoke", () => {
    const source = readWorkflow("deploy-vercel.yml");
    expect(source).toContain("release-staging");
    expect(source).toContain("hotfix");
    expect(source).toContain("git merge-base --is-ancestor");
    expect(source).toContain("git push origin");
    expect(source).toContain("Await automatic Production deployment");
    expect(source).toContain("https://app.neurocapacitar.com.br");
    expect(source).toContain("name: Smoke Production public profile");
    expect(source).toContain("checkout_status=");
    expect(source).toContain("webhook_status=");
  });

  it("keeps Staging reset manual, backed up, and explicitly confirmed", () => {
    const source = readWorkflow("reset-staging.yml");
    expect(source).toContain("options: [plan, execute]");
    expect(source).toContain("RESET_STAGING_DATA");
    expect(source).toContain("name: vercel-staging");
    expect(source.indexOf("Create Staging backup before execute")).toBeLessThan(
      source.indexOf("Execute guarded reset")
    );
    expect(source).toContain("db:reset:staging");
    expect(source).toContain("Verify post-reset Admin invariant");
  });
});
