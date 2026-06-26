import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin expiration date parsing", () => {
  it("parses date-only expiration as an end-of-day deadline and blocks past days", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("parseExpirationDateSelection");
    expect(source).toContain("23, 59, 59, 999");
    expect(source).toContain(
      "A data de expiracao nao pode ser anterior a hoje."
    );
  });
});
