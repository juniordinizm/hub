import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REMOVED_PRODUCT_SYMBOLS = [
  ["/products", "/create"].join(""),
  ["create", "Product"].join(""),
  ["buildAbacatePay", "ProductRequest"].join(""),
  ["AbacatePay", "ProductRequest"].join(""),
  ["createAbacatePay", "CourseProduct"].join(""),
] as const;
const TYPESCRIPT_SOURCE_RE = /\.(?:ts|tsx)$/;

const getSourcePaths = async (directory: URL): Promise<URL[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const sourcePaths: URL[] = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      sourcePaths.push(
        ...(await getSourcePaths(new URL(`${entry.name}/`, directory)))
      );
    } else if (
      entry.isFile() &&
      TYPESCRIPT_SOURCE_RE.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      sourcePaths.push(entryUrl);
    }
  }

  return sourcePaths;
};

describe("AbacatePay product removal", () => {
  it("keeps no remote product creation path in payment sources", async () => {
    const paymentsDirectory = new URL("./", import.meta.url);
    const sourcePaths = await getSourcePaths(paymentsDirectory);
    const sources = await Promise.all(
      sourcePaths.map(async (path) => await readFile(path, "utf8"))
    );
    const combinedSource = sources.join("\n");

    for (const symbol of REMOVED_PRODUCT_SYMBOLS) {
      expect(combinedSource).not.toContain(symbol);
    }
  });
});
