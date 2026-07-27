import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { getScheduledJobEarlyResponse } from "./scheduled-job-request";

const request = (token?: string): Request =>
  new Request("https://app.example.com/api/cron/outbox", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("scheduled job request guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates before exposing the kill-switch state", () => {
    dependencies.getServerEnv.mockReturnValue({
      CRON_SECRET: "secret",
      NODE_ENV: "production",
      SCHEDULED_JOBS_ENABLED: false,
    });

    expect(getScheduledJobEarlyResponse(request())?.status).toBe(401);
  });

  it("returns a successful skip while scheduled work is disabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      CRON_SECRET: "secret",
      NODE_ENV: "production",
      SCHEDULED_JOBS_ENABLED: false,
    });

    const response = getScheduledJobEarlyResponse(request("secret"));

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      reason: "scheduled_jobs_disabled",
      skipped: true,
    });
  });

  it("allows an authenticated request when scheduled work is enabled", () => {
    dependencies.getServerEnv.mockReturnValue({
      CRON_SECRET: "secret",
      NODE_ENV: "production",
      SCHEDULED_JOBS_ENABLED: true,
    });

    expect(getScheduledJobEarlyResponse(request("secret"))).toBeNull();
  });
});
