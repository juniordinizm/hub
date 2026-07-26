import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cronRoutes = [
  ["enrollments", 800],
  ["jmvstream", 300],
  ["outbox", 300],
  ["maintenance", 800],
] as const;

describe("Vercel cron configuration", () => {
  it("runs database-backed functions in the same region as production Neon", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      regions?: string[];
    };
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      engines?: { node?: string };
    };

    expect(config.regions).toEqual(["gru1"]);
    expect(packageJson.engines?.node).toBe("24.x");
  });

  it("schedules JMVStream player reconciliation", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/jmvstream",
      schedule: "*/5 * * * *",
    });
  });

  it("gives every cron a Node runtime and an explicit Pro duration budget", async () => {
    for (const [jobName, duration] of cronRoutes) {
      const source = await readFile(
        resolve("src/app/api/cron", jobName, "route.ts"),
        "utf8"
      );

      expect(source).toContain('export const runtime = "nodejs"');
      expect(source).toContain(`export const maxDuration = ${duration}`);
      expect(source).toContain("getScheduledJobEarlyResponse");
      expect(source).toContain("runWithScheduledJobLease");
      expect(source).not.toContain("pg_advisory_lock");
    }
  });
});
