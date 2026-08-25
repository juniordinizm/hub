import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin actions and schema", () => {
  it("guards every banner mutation with the settings permission", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );
    const bannerSection = source.slice(
      source.indexOf("const assertBannerLink")
    );

    expect(bannerSection).toContain('requirePermission("manageSettings")');
    expect(bannerSection).not.toContain('requireRole(["admin", "support"])');
  });

  it("returns retry delete failures as action state instead of throwing a server error", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("retryJmvstreamDeleteAction");
    expect(source).toContain("ok: false");
    expect(source).toContain("Nao foi possivel apagar o video na JMVStream.");
  });

  it("stores module and lesson publication lifecycle status in the schema", async () => {
    const schema = await readFile(
      new URL("../../db/schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain('status: courseStatusEnum("status")');
    expect(schema).toContain("modules");
    expect(schema).toContain("lessons");
  });
});
