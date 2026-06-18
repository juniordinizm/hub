import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JMVStream server SQL", () => {
  it("does not use ambiguous updated_at references in ordering", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("order by updated_at");
  });
});
