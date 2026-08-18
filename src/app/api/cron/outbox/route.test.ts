import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("outbox cron route", () => {
  it("does not attribute the aggregate worker to a single provider", async () => {
    const source = await readFile(
      new URL("./route.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('operation: "cron.outbox"');
    expect(source).not.toContain('provider: "resend"');
  });
});
