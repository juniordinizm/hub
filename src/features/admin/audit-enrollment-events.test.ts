import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin audit enrollment events", () => {
  it("surfaces enrollment status and expiration changes in audit history", async () => {
    const [serverSource, pageSource] = await Promise.all([
      readFile(new URL("./server.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../../app/(admin)/admin/auditoria/page.tsx", import.meta.url),
        "utf8"
      ),
    ]);

    expect(serverSource).toContain("enrollment_events");
    expect(serverSource).toContain("payment_refunded");
    expect(serverSource).toContain("payment_disputed");
    expect(pageSource).toContain("enrollment.expiration_extended");
    expect(pageSource).toContain("enrollment.expiration_reduced");
    expect(pageSource).toContain("enrollment.payment_refunded");
    expect(pageSource).toContain("enrollment.payment_disputed");
    expect(pageSource).toContain("enrollment.access_blocked");
    expect(pageSource).toContain("enrollment.access_restored");
  });
});
