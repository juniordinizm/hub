import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cronRoutes = [
  ["asaas-webhooks", 300, "runAsaasWebhookJob"],
  ["enrollments", 800, "runWithScheduledJobLease"],
  ["jmvstream", 300, "runWithScheduledJobLease"],
  ["outbox", 300, "runOutboxJob"],
  ["resend-webhooks", 300, "runResendWebhookJob"],
  ["maintenance", 800, "runWithScheduledJobLease"],
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

  it("traces certificate preview fonts and pins the preview route to Node.js", async () => {
    const nextConfigSource = await readFile("next.config.ts", "utf8");
    const previewRouteSource = await readFile(
      resolve("src/app/certificados/[code]/preview/route.ts"),
      "utf8"
    );

    expect(nextConfigSource).toContain('"public/fonts/certificates/**/*"');
    expect(previewRouteSource).toContain('export const runtime = "nodejs"');
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
      ignoreCommand?: string;
      regions?: string[];
    };
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      engines?: { node?: string };
    };

    expect(config.regions).toEqual(["gru1"]);
    expect(packageJson.engines?.node).toBe("24.x");
  });

  it("lets only main and staging reach the Git Integration build", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      ignoreCommand?: string;
    };

    expect(config.ignoreCommand).toContain("VERCEL_GIT_COMMIT_REF");
    expect(config.ignoreCommand).toContain('= "main"');
    expect(config.ignoreCommand).toContain('= "staging"');
    expect(config.ignoreCommand).toContain("exit 0");
    expect(config.ignoreCommand).toContain("exit 1");
  });

  it("schedules JMVStream player reconciliation every fifteen minutes", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/jmvstream",
      schedule: "*/15 * * * *",
    });
  });

  it("schedules the Asaas webhook inbox worker every fifteen minutes", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/cron/asaas-webhooks",
      schedule: "*/15 * * * *",
    });
  });

  it("gives every cron a Node runtime and an explicit Pro duration budget", async () => {
    for (const [jobName, duration, workerName] of cronRoutes) {
      const source = await readFile(
        resolve("src/app/api/cron", jobName, "route.ts"),
        "utf8"
      );

      expect(source).toContain('export const runtime = "nodejs"');
      expect(source).toContain(`export const maxDuration = ${duration}`);
      expect(source).toContain("getScheduledJobEarlyResponse");
      expect(source).toContain(workerName);
      expect(source).not.toContain("pg_advisory_lock");
    }
  });
});
