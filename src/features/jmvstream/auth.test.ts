import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  authenticateJmvstreamApi: vi.fn(),
  createJmvstreamClient: vi.fn(),
  getServerEnv: vi.fn(),
  isJmvstreamJwtUsable: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/jmvstream/client", () => ({
  authenticateJmvstreamApi: dependencies.authenticateJmvstreamApi,
  createJmvstreamClient: dependencies.createJmvstreamClient,
  isJmvstreamJwtUsable: dependencies.isJmvstreamJwtUsable,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { getConfiguredJmvstreamClient } from "./auth";

describe("JMVStream authentication boundary", () => {
  beforeEach(() => {
    dependencies.createJmvstreamClient.mockReset();
    dependencies.getServerEnv.mockReset();
    dependencies.isJmvstreamJwtUsable.mockReset();
    dependencies.getServerEnv.mockReturnValue({
      JMVSTREAM_API_BASE_URL: "https://api.example.test",
      JMVSTREAM_API_TOKEN: "valid-token",
      JMVSTREAM_AUTH_RESOURCE: undefined,
      JMVSTREAM_PLAN_ID: "plan-123",
    });
    dependencies.isJmvstreamJwtUsable.mockReturnValue(true);
  });

  it("creates the provider client with the configured usable token", async () => {
    const client = { listFolders: vi.fn() };
    dependencies.createJmvstreamClient.mockReturnValue(client);

    await expect(getConfiguredJmvstreamClient()).resolves.toBe(client);
    expect(dependencies.createJmvstreamClient).toHaveBeenCalledWith({
      apiBaseUrl: "https://api.example.test",
      apiToken: "valid-token",
      planId: "plan-123",
    });
  });

  it("rejects configuration without a plan before contacting the provider", async () => {
    dependencies.getServerEnv.mockReturnValue({
      JMVSTREAM_API_BASE_URL: "https://api.example.test",
      JMVSTREAM_API_TOKEN: "valid-token",
      JMVSTREAM_AUTH_RESOURCE: undefined,
      JMVSTREAM_PLAN_ID: undefined,
    });

    await expect(getConfiguredJmvstreamClient()).rejects.toThrow(
      "Configure JMVSTREAM_PLAN_ID"
    );
    expect(dependencies.createJmvstreamClient).not.toHaveBeenCalled();
  });
});
