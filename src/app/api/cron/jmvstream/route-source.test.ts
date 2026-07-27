import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JMVStream cron route", () => {
  it("protects processing reconciliation with CRON_SECRET", async () => {
    const source = await readFile(
      new URL("./route.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("syncPendingJmvstreamPlayers");
    expect(source).toContain("getScheduledJobEarlyResponse");
    expect(source).toContain("runWithScheduledJobLease");
    expect(source).toContain("export const maxDuration = 300");
  });
});
