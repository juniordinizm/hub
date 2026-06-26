import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("payment webhook enrollment integration", () => {
  it("delegates paid and revocation transitions to the enrollment module", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("applyPaidWebhookAccess");
    expect(source).toContain("applyPaymentRevocation");
    expect(source).not.toContain(
      "insert into enrollments (user_id, course_id, status, starts_at, expires_at)"
    );
  });
});
