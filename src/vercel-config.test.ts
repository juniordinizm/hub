import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cronRoutes = [
  ["asaas-webhooks", 300],
  ["enrollments", 800],
  ["jmvstream", 300],
  ["outbox", 300],
  ["maintenance", 800],
] as const;

describe("Vercel cron configuration", () => {
  it("loads PDFKit natively so its standard font assets remain addressable", async () => {
    const source = await readFile("next.config.ts", "utf8");

    expect(source).toContain('serverExternalPackages: ["pdfkit"]');
  });

  it("traces Sharp and its native runtime assets into server functions", async () => {
    const source = await readFile("next.config.ts", "utf8");

    expect(source).toContain('"node_modules/sharp/**/*"');
    expect(source).toContain('"node_modules/@img/sharp-*/**/*"');
  });

  it("disables Sentry release and source-map uploads in isolated E2E builds", async () => {
    const source = await readFile("next.config.ts", "utf8");

    expect(source).toContain('process.env.E2E_TEST_MODE === "true"');
    expect(source).toContain('isE2eTest ? "" : process.env.SENTRY_AUTH_TOKEN');
    expect(source).toContain(
      "isProduction && !isE2eTest ? sentryAuthToken : undefined"
    );
    expect(source).toContain(
      "disable: !sentryBuildConfiguration.uploadSourceMaps"
    );
  });

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

  it("schedules the Asaas webhook inbox worker every minute", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/asaas-webhooks",
      schedule: "* * * * *",
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
