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

  it("does not overwrite the original paid expiration when a paid event is replayed", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("base_expires_at");
    expect(source).toContain("baseExpiresAt: grant.base_expires_at");
    expect(source).not.toContain("base_expires_at = excluded.base_expires_at");
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

  it("supports manual access blocking without deleting enrollments", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("blockEnrollmentAccess");
    expect(source).toContain("restoreEnrollmentAccess");
    expect(source).toContain("manual_access_block");
    expect(source).toContain("access_manually_blocked");
    expect(source).toContain("access_manual_block_removed");
    expect(source).not.toContain("delete from enrollments");
  });
});
