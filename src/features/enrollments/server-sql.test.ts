import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("enrollment server SQL contracts", () => {
  it("stores paid access in grants and keeps enrollments as a projection", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("applyPaidWebhookAccess");
    expect(source).toContain("insert into enrollment_grants");
    expect(source).toContain("rebuildEnrollmentProjection");
    expect(source).toContain("source_type = 'abacatepay_order'");
  });

  it("supports audited expiration adjustments without creating manual grants", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("extendEnrollmentExpiration");
    expect(source).toContain("insert into enrollment_expiration_adjustments");
    expect(source).toContain("expiration_extended");
    expect(source).not.toContain("source_type = 'manual'");
  });
});
