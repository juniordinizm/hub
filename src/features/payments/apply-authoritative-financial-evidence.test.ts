import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaidWebhookAccess: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  resolveLocalOrderIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/enrollments/server", () => ({
  applyPaidWebhookAccess: dependencies.applyPaidWebhookAccess,
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
vi.mock("@/features/payments/order-identity", () => ({
  LocalOrderIdentityError: class LocalOrderIdentityError extends Error {},
  resolveLocalOrderIdentity: dependencies.resolveLocalOrderIdentity,
}));

import { applyConfirmedPaymentAccess } from "./apply-authoritative-financial-evidence";

const order = {
  accessDurationMonths: 12,
  buyerIdentityStatus: "resolved",
  courseId: "course-1",
  id: "order-1",
  status: "pending",
  userId: "user-1",
} as const;

describe("authoritative financial evidence application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.resolveLocalOrderIdentity.mockResolvedValue({
      activationRequired: false,
      userId: "user-1",
    });
  });

  it("does not grant when the paid transition is blocked by a pending review", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(false);

    expect(dependencies.resolveLocalOrderIdentity).not.toHaveBeenCalled();
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("applies access and an idempotent outbox message after financial convergence", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "order-1" }] }),
    };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(true);

    expect(dependencies.applyPaidWebhookAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        accessDurationMonths: 12,
        courseId: "course-1",
        orderId: "order-1",
        userId: "user-1",
      })
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        idempotencyKey: "email.access-released/order-1/v1",
      }),
    });
  });
});
