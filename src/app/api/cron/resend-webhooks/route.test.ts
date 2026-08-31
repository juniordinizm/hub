import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Resend webhook cron route", () => {
  it("uses its own lease, worker, operation and provider", async () => {
    const source = await readFile(
      new URL("./route.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("runResendWebhookJob");
    expect(source).toContain('operation: "cron.resend_webhooks"');
    expect(source).toContain('provider: "resend"');
    expect(source).toContain("getScheduledJobEarlyResponse(request)");
  });
});
