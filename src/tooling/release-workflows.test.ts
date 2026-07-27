import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (fileName: string): string =>
  readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${fileName}`),
    "utf8"
  );

const githubExpression = (expression: string): string =>
  ["$", "{{ ", expression, " }}"].join("");

const shellVariable = (name: string): string => ["$", "{", name, "}"].join("");

describe("Development migration workflow", () => {
  it("migrates only the protected Development target from an approved main SHA", () => {
    const workflow = readWorkflow("migrate-development.yml");

    expect(workflow).toContain("confirm_development:");
    expect(workflow).toContain("group: neon-development-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("name: neon-development");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain('release_sha="$(git rev-parse HEAD)"');
    expect(workflow).toContain(
      `${shellVariable("GITHUB_REF")}" != "refs/heads/main"`
    );
    expect(workflow).toContain(
      `DATABASE_URL_DIRECT: ${githubExpression("secrets.DATABASE_URL_DIRECT")}`
    );
    expect(workflow).toContain(
      `DEVELOPMENT_DATABASE_HOST: ${githubExpression(
        "vars.DEVELOPMENT_DATABASE_HOST"
      )}`
    );
    expect(workflow).toContain("bun run db:migrate:development");
    expect(workflow).toContain(
      "bun run db:migrations:inspect -- --environment=neon-development"
    );
    expect(workflow).toContain(
      "No successful CI run exists for the current main SHA."
    );
  });
});
