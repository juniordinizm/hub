import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isScheduledJobName, scheduledJobs } from "./scheduled-jobs";

describe("scheduled jobs", () => {
  it("is the provider-neutral authority for every Vercel compatibility cron", async () => {
    const vercelConfig = JSON.parse(
      await readFile(resolve(import.meta.dirname, "../../vercel.json"), "utf8")
    ) as { crons: Array<{ path: string; schedule: string }> };

    expect(vercelConfig.crons).toEqual(
      Object.values(scheduledJobs).map(({ path, schedule }) => ({
        path,
        schedule,
      }))
    );
  });

  it("accepts only declared own-property job names", () => {
    expect(isScheduledJobName("asaasWebhooks")).toBe(true);
    expect(isScheduledJobName("outbox")).toBe(true);
    expect(isScheduledJobName("constructor")).toBe(false);
    expect(isScheduledJobName("toString")).toBe(false);
  });

  it("runs recoverable inbox workers every fifteen minutes", () => {
    expect(scheduledJobs.asaasWebhooks).toEqual({
      deadlineMs: 270_000,
      leaseMs: 360_000,
      path: "/api/cron/asaas-webhooks",
      schedule: "*/15 * * * *",
    });
    expect(scheduledJobs.jmvstream.schedule).toBe("*/15 * * * *");
    expect(scheduledJobs.outbox.schedule).toBe("*/15 * * * *");
    expect(scheduledJobs["resend-webhooks"].schedule).toBe("*/15 * * * *");
  });
});
