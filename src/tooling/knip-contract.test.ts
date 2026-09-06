import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const readRepositoryFile = (fileName: string): string =>
  readFileSync(resolve(repositoryRoot, fileName), "utf8");
const knipConfiguration = readRepositoryFile("knip.jsonc");
const hookInstaller = readRepositoryFile("scripts/install-git-hooks.ts");
const packageManifest = readRepositoryFile("package.json");

const getArrayBody = (key: string): string => {
  const match = knipConfiguration.match(
    new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`)
  );
  return match?.[1] ?? "";
};

describe("Knip dependency contract", () => {
  it("documents the dynamically resolved Lefthook binary as intentional", () => {
    expect(hookInstaller).toContain("lefthook");
    expect(packageManifest).toContain(
      '"prepare": "bun scripts/install-git-hooks.ts"'
    );
    expect(getArrayBody("ignoreDependencies")).toContain('"lefthook"');
    expect(getArrayBody("ignoreBinaries")).toContain('"lefthook"');
  });
});
