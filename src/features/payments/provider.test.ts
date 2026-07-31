import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { getApplicationUrl, getAsaasProviderClient } from "./provider";

describe("Asaas provider boundary", () => {
  it("creates the server-only client from the complete Asaas configuration", () => {
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
      ASAAS_API_KEY: "sandbox-token",
      ASAAS_USER_AGENT: "hub/1.0 payments@example.test",
      NEXT_PUBLIC_APP_URL: "https://hub.example.test",
    });

    expect(getAsaasProviderClient()).toMatchObject({
      accessToken: "sandbox-token",
      baseUrl: "https://api-sandbox.asaas.com",
      userAgent: "hub/1.0 payments@example.test",
    });
  });

  it("fails safely when any required Asaas setting is absent", () => {
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
      ASAAS_API_KEY: "secret-that-must-not-leak",
      ASAAS_USER_AGENT: undefined,
      NEXT_PUBLIC_APP_URL: "https://hub.example.test",
    });

    expect(() => getAsaasProviderClient()).toThrow(
      "ConfiguraÃ§Ã£o Asaas incompleta."
    );
    expect(() => getAsaasProviderClient()).not.toThrow(
      "secret-that-must-not-leak"
    );
  });

  it("builds absolute application URLs from the public origin", () => {
    dependencies.getServerEnv.mockReturnValue({
      NEXT_PUBLIC_APP_URL: "https://hub.example.test",
    });

    expect(getApplicationUrl("/app")).toBe("https://hub.example.test/app");
  });
});
