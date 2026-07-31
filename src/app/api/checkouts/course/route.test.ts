import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createPublicCourseCheckout: vi.fn(),
  getServerEnv: vi.fn(),
  observeOperation: vi.fn(),
}));

vi.mock("@/features/payments/public-checkout", () => ({
  createPublicCourseCheckout: dependencies.createPublicCourseCheckout,
  PublicCheckoutRateLimitError: class PublicCheckoutRateLimitError extends Error {},
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));

import { POST } from "./route";

describe("legacy public checkout containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "disabled",
    "authenticated",
  ] as const)("blocks public checkout in %s mode before body and dependencies", async (mode) => {
    dependencies.getServerEnv.mockReturnValue({
      CLIENT_IP_SOURCE: "x-forwarded-for",
      PAYMENTS_CHECKOUT_MODE: mode,
    });
    const request = new Request("https://hub.example/api/checkouts/course", {
      body: JSON.stringify({ courseSlug: "course" }),
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Servico de checkout indisponivel.",
    });
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
    expect(dependencies.observeOperation).not.toHaveBeenCalled();
  });

  it("propagates unexpected environment failures", async () => {
    const unexpectedError = new Error("unexpected environment failure");
    dependencies.getServerEnv.mockImplementation(() => {
      throw unexpectedError;
    });
    const request = new Request("https://hub.example/api/checkouts/course", {
      method: "POST",
    });

    await expect(POST(request)).rejects.toBe(unexpectedError);
  });
});
