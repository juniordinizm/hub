import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const knipConfiguration = readFileSync("knip.jsonc", "utf8");
const hookInstaller = readFileSync("scripts/install-git-hooks.ts", "utf8");
const packageManifest = readFileSync("package.json", "utf8");

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
