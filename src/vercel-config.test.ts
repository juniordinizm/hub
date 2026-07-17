import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Vercel cron configuration", () => {
  it("schedules JMVStream player reconciliation", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/jmvstream",
      schedule: "*/5 * * * *",
    });
  });
});
