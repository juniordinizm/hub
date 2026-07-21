import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { getAbacatePayProviderClient, getApplicationUrl } from "./provider";

describe("AbacatePay provider boundary", () => {
  it("creates a provider client from the server-only configuration", () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_API_BASE_URL: "https://api.example.test/v2",
      ABACATEPAY_API_KEY: undefined,
      ABACATE_PAY_API_KEY: "provider-key",
      NEXT_PUBLIC_APP_URL: "https://hub.example.test",
    });

    expect(getAbacatePayProviderClient()).toMatchObject({
      apiKey: "provider-key",
      baseUrl: "https://api.example.test/v2",
    });
    expect(getApplicationUrl("/app")).toBe("https://hub.example.test/app");
  });

  it("fails before the provider call when no API key is configured", () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_API_BASE_URL: "https://api.example.test/v2",
      ABACATEPAY_API_KEY: undefined,
      ABACATE_PAY_API_KEY: undefined,
      NEXT_PUBLIC_APP_URL: "https://hub.example.test",
    });

    expect(() => getAbacatePayProviderClient()).toThrow(
      "Configure ABACATE_PAY_API_KEY"
    );
  });
});
