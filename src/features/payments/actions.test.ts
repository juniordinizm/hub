import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCourseCheckout: vi.fn(),
  getServerEnv: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/payments/refunds", () => ({
  issueRefundConfirmation: vi.fn(),
  requestFullRefund: vi.fn(),
}));
vi.mock("@/features/payments/server", () => ({
  createCourseCheckout: dependencies.createCourseCheckout,
  resolvePaymentReview: vi.fn(),
  retryFailedAbacatePayWebhook: vi.fn(),
}));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import { startCourseCheckoutAction } from "./actions";

describe("legacy authenticated checkout containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks disabled checkout before session and provider", async () => {
    dependencies.getServerEnv.mockReturnValue({
      PAYMENTS_CHECKOUT_MODE: "disabled",
    });
    const form = new FormData();
    form.set("courseId", "4a45d650-fc63-44c9-b2d1-6c73d52de84c");

    await expect(startCourseCheckoutAction(form)).rejects.toThrow(
      "Checkout indisponivel."
    );
    expect(dependencies.requireSession).not.toHaveBeenCalled();
    expect(dependencies.createCourseCheckout).not.toHaveBeenCalled();
  });
});
