import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { invokeScheduledJob } from "./scheduled-job-runner";
import { scheduledJobs } from "./scheduled-jobs";

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

  it("invokes only a declared endpoint with bearer authentication", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(
      invokeScheduledJob({
        environment: {
          CRON_SECRET: "private-token",
          NEXT_PUBLIC_APP_URL: "https://hub.example.com/",
        },
        fetchImpl,
        jobName: "outbox",
      })
    ).resolves.toMatchObject({ jobName: "outbox", status: 200 });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hub.example.com/api/cron/outbox",
      expect.objectContaining({
        headers: { authorization: "Bearer private-token" },
        redirect: "error",
      })
    );
  });

  it("rejects unknown jobs and incomplete runtime configuration", async () => {
    await expect(
      invokeScheduledJob({
        environment: {},
        jobName: "not-a-job",
      })
    ).rejects.toThrow("Unknown scheduled job");

    await expect(
      invokeScheduledJob({
        environment: { NEXT_PUBLIC_APP_URL: "https://hub.example.com" },
        jobName: "outbox",
      })
    ).rejects.toThrow("CRON_SECRET");
  });
});
