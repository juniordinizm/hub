import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaidWebhookAccess: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect }),
}));
vi.mock("@/features/enrollments/server", () => ({
  applyPaidWebhookAccess: dependencies.applyPaidWebhookAccess,
}));

import { resolvePaymentReview } from "./payment-reviews";

const createClient = (
  review: {
    access_duration_months: number | null;
    course_id: string;
    order_id: string;
    status: "pending";
    type:
      | "amount_mismatch"
      | "buyer_identity"
      | "event_anomaly"
      | "partial_refund"
      | "terminal_conflict";
    user_id: string | null;
  } | null
) => {
  const query = vi.fn((statement: string) => {
    if (statement.includes("from payment_reviews")) {
      return { rows: review ? [review] : [] };
    }
    if (statement.includes("update orders")) {
      return { rows: [{ id: review?.order_id }] };
    }
    return { rows: [] };
  });

  return {
    query,
    release: vi.fn(),
  };
};

describe("payment review resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves terminal conflicts after the admin permission boundary", async () => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type: "terminal_conflict",
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await resolvePaymentReview({
      actorUserId: "admin-1",
      decision: "rejected",
      decisionReason: " conflito confirmado ",
      reviewId: "review-1",
    });

    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    "approved",
    "rejected",
  ] as const)("rejects generic %s decisions for buyer identity reviews after locking", async (decision) => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type: "buyer_identity",
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      resolvePaymentReview({
        actorUserId: "admin-1",
        decision,
        decisionReason: "decisao indevida",
        reviewId: "review-1",
      })
    ).rejects.toThrow("Revisao de identidade exige reembolso integral.");

    const statements = client.query.mock.calls.map(([statement]) =>
      String(statement)
    );
    expect(statements[0]).toBe("begin");
    expect(statements[1]).toContain("for update of payment_reviews, orders");
    expect(statements).not.toContain(
      expect.stringContaining("update payment_reviews")
    );
    expect(statements).not.toContain(
      expect.stringContaining("insert into audit_logs")
    );
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
  });

  it.each([
    "approved",
    "rejected",
  ] as const)("prioritizes the buyer identity guard for an empty %s decision reason after locking", async (decision) => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type: "buyer_identity",
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      resolvePaymentReview({
        actorUserId: "admin-1",
        decision,
        decisionReason: "   ",
        reviewId: "review-1",
      })
    ).rejects.toThrow("Revisao de identidade exige reembolso integral.");

    const statements = client.query.mock.calls.map(([statement]) =>
      String(statement)
    );
    expect(statements[0]).toBe("begin");
    expect(statements[1]).toContain("for update of payment_reviews, orders");
    expect(statements).not.toContain(
      expect.stringContaining("update payment_reviews")
    );
    expect(statements).not.toContain(
      expect.stringContaining("insert into audit_logs")
    );
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "event_anomaly",
      "Anomalia financeira exige conciliacao ou reprocessamento.",
    ],
    [
      "partial_refund",
      "Reembolso parcial exige tratamento financeiro especifico.",
    ],
  ] as const)("rejects generic decisions for %s reviews", async (type, message) => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type,
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      resolvePaymentReview({
        actorUserId: "admin-1",
        decision: "rejected",
        decisionReason: "decisao generica indevida",
        reviewId: "review-1",
      })
    ).rejects.toThrow(message);

    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
  });

  it("rejects an empty reason for other review types after locking", async () => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type: "amount_mismatch",
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      resolvePaymentReview({
        actorUserId: "support-1",
        decision: "rejected",
        decisionReason: " ",
        reviewId: "review-1",
      })
    ).rejects.toThrow("Informe o motivo da decisao financeira.");

    expect(client.query.mock.calls[0]?.[0]).toBe("begin");
    expect(String(client.query.mock.calls[1]?.[0])).toContain(
      "for update of payment_reviews, orders"
    );
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("approves an amount mismatch by granting access and auditing the decision", async () => {
    const client = createClient({
      access_duration_months: 12,
      course_id: "course-1",
      order_id: "order-1",
      status: "pending",
      type: "amount_mismatch",
      user_id: "user-1",
    });
    dependencies.connect.mockResolvedValue(client);

    await resolvePaymentReview({
      actorUserId: "admin-1",
      decision: "approved",
      decisionReason: " valor conferido ",
      reviewId: "review-1",
    });

    expect(dependencies.applyPaidWebhookAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        accessDurationMonths: 12,
        client,
        courseId: "course-1",
        orderId: "order-1",
        userId: "user-1",
      })
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("update payment_reviews"),
      ["review-1", "approved", "valor conferido", "admin-1"]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      [
        "admin-1",
        "payment_review.resolved",
        "review-1",
        "approved",
        "valor conferido",
      ]
    );
    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
