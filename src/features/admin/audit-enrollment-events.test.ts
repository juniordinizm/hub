import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin audit enrollment events", () => {
  it("surfaces enrollment status and expiration changes in audit history", async () => {
    const [serverSource, presentationSource] = await Promise.all([
      readFile(new URL("./server.ts", import.meta.url), "utf8"),
      readFile(new URL("./audit-presentation.ts", import.meta.url), "utf8"),
    ]);

    expect(serverSource).toContain("enrollment_events");
    expect(serverSource).toContain("payment_refunded");
    expect(serverSource).toContain("payment_disputed");
    expect(presentationSource).toContain("enrollment.expiration_extended");
    expect(presentationSource).toContain("enrollment.expiration_reduced");
    expect(presentationSource).toContain("enrollment.payment_refunded");
    expect(presentationSource).toContain("enrollment.payment_disputed");
    expect(presentationSource).toContain("enrollment.access_blocked");
    expect(presentationSource).toContain("enrollment.access_restored");
    expect(presentationSource).toContain("student.platform_blocked");
    expect(presentationSource).toContain("student.platform_restored");
  });
});
