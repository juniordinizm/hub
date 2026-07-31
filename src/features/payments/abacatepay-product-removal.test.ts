import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const LINE_BREAK_PATTERN = /\r?\n/u;

interface SourceReference {
  content: string;
  path: string;
}

const REMOVED_EXECUTABLE_PATHS = [
  "src/app/api/webhooks/abacatepay",
  "src/features/payments/abacatepay-client.ts",
  "src/features/payments/abacatepay.ts",
  "src/features/payments/server.ts",
  ".vscode/mcp.json",
] as const;

const HISTORICAL_OPERATIONAL_OCCURRENCES = [
  {
    content:
      "AbacatePay e JMVStream passaram em leitura; o reset de senha foi aceito pela",
    path: "docs/operations/vercel-first-launch-checklist.md",
  },
  {
    content:
      "AbacatePay e JMVStream responderam a leituras autenticadas, o webhook sem",
    path: "docs/operations/vercel-migration-status.md",
  },
] as const satisfies readonly SourceReference[];

const isDedicatedHistoricalEvidence = (path: string): boolean =>
  path === "docs/Plano de migracao.md" ||
  path.startsWith("docs/reviews/") ||
  path.startsWith("docs/superpowers/") ||
  path.startsWith("plans/");

const isMigrationEvidence = (path: string): boolean =>
  path === "src/db/asaas-schema-contract.test.ts" ||
  path.startsWith("src/db/migrations/");

const isAllowedHistoricalOccurrence = (reference: SourceReference): boolean =>
  HISTORICAL_OPERATIONAL_OCCURRENCES.some(
    (allowed) =>
      allowed.path === reference.path && allowed.content === reference.content
  );

const isExecutableOrConfigurationReference = (path: string): boolean =>
  path === ".env.example" ||
  path === ".gitignore" ||
  path === ".vscode/mcp.json" ||
  path.startsWith("scripts/") ||
  (path.startsWith("src/") &&
    path !== "src/db/asaas-schema-contract.test.ts" &&
    path !== "src/features/payments/abacatepay-product-removal.test.ts" &&
    !path.startsWith("src/db/migrations/"));

const getReferences = async (): Promise<SourceReference[]> => {
  const { stdout } = await execFileAsync(
    "git",
    ["grep", "-n", "-i", "abacate", "--", "."],
    { cwd: repositoryRoot }
  );

  return stdout
    .trim()
    .split(LINE_BREAK_PATTERN)
    .filter(Boolean)
    .map((line) => {
      const pathSeparator = line.indexOf(":");
      const lineNumberSeparator = line.indexOf(":", pathSeparator + 1);

      return {
        content: line.slice(lineNumberSeparator + 1),
        path: line.slice(0, pathSeparator),
      };
    });
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(`${repositoryRoot}/${path}`);
    return true;
  } catch {
    return false;
  }
};

describe("legacy payment provider removal", () => {
  it("has no executable route, client, parser, processor, retry, or MCP entrypoint", async () => {
    const existingPaths = (
      await Promise.all(
        REMOVED_EXECUTABLE_PATHS.map(async (path) => ({
          exists: await pathExists(path),
          path,
        }))
      )
    )
      .filter(({ exists }) => exists)
      .map(({ path }) => path);

    expect(existingPaths).toEqual([]);

    const executableReferences = (await getReferences()).filter((reference) =>
      isExecutableOrConfigurationReference(reference.path)
    );

    expect(executableReferences).toEqual([]);
  });

  it("allows only exact historical occurrences in current operational documents", async () => {
    const references = await getReferences();
    const forbiddenReferences = references.filter(
      (reference) =>
        !(
          isDedicatedHistoricalEvidence(reference.path) ||
          isMigrationEvidence(reference.path)
        ) &&
        reference.path !==
          "src/features/payments/abacatepay-product-removal.test.ts" &&
        !isAllowedHistoricalOccurrence(reference)
    );

    expect(forbiddenReferences).toEqual([]);

    for (const allowed of HISTORICAL_OPERATIONAL_OCCURRENCES) {
      expect(
        references.filter(
          (reference) =>
            reference.path === allowed.path &&
            reference.content === allowed.content
        )
      ).toHaveLength(1);
    }
  });
});
