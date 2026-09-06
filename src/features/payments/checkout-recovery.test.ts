import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/db";

vi.mock("@/db", () => ({ getPool: vi.fn() }));
vi.mock("server-only", () => ({}));

import { readPublicCheckoutStatus } from "./checkout-recovery";

const input = {
  checkoutAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  courseSlug: "course",
};
const DECISION_NOW = new Date("2026-09-06T12:00:00.000Z");

describe("readPublicCheckoutStatus", () => {
  beforeEach(() => vi.mocked(getPool).mockReset());

  it.each([
    ["active", "https://sandbox.asaas.com/c/checkout", "ready"],
    ["active", null, "processing"],
    ["pending", null, "processing"],
    ["creating", null, "processing"],
    ["uncertain", null, "processing"],
    ["failed", null, "failed"],
    ["cancelled", null, "failed"],
    ["expired", null, "failed"],
  ] as const)("maps %s safely to %s", async (checkoutStatus, checkoutUrl, expected) => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          checkout_status: checkoutStatus,
          checkout_url: checkoutUrl,
          id: input.checkoutAttemptId,
        },
      ],
    });
    vi.mocked(getPool).mockReturnValue({ query } as never);

    const result = await readPublicCheckoutStatus(input);

    expect(result.status).toBe(expected);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("provider = 'asaas'"),
      [input.checkoutAttemptId, input.courseSlug]
    );
  });

  it("returns the same generic unavailable result for a missing or mismatched attempt", async () => {
    vi.mocked(getPool).mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as never);

    await expect(readPublicCheckoutStatus(input)).resolves.toEqual({
      error: "Checkout indisponivel.",
      retryAllowed: false,
      status: "unavailable",
    });
  });

  it("terminalizes a stale pre-provider reservation as retryable failure", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            checkout_attempt_count: 0,
            checkout_last_attempt_at: null,
            checkout_status: "pending",
            checkout_url: null,
            id: input.checkoutAttemptId,
            provider_checkout_id: null,
            provider_customer_id: null,
            provider_payment_id: null,
            updated_at: new Date(DECISION_NOW.getTime() - 31_000),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: input.checkoutAttemptId }] });
    vi.mocked(getPool).mockReturnValue({ query } as never);

    await expect(
      readPublicCheckoutStatus({ ...input, now: () => DECISION_NOW })
    ).resolves.toEqual({
      orderId: input.checkoutAttemptId,
      retryAllowed: true,
      status: "failed",
    });
    expect(query.mock.calls[1]?.[0]).toContain(
      "checkout_error_message = 'checkout_reservation_expired'"
    );
  });

  it("keeps a recent pre-provider reservation processing", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          checkout_attempt_count: 0,
          checkout_last_attempt_at: null,
          checkout_status: "pending",
          checkout_url: null,
          id: input.checkoutAttemptId,
          provider_checkout_id: null,
          provider_customer_id: null,
          provider_payment_id: null,
          updated_at: new Date(DECISION_NOW.getTime() - 1000),
        },
      ],
    });
    vi.mocked(getPool).mockReturnValue({ query } as never);

    await expect(
      readPublicCheckoutStatus({ ...input, now: () => DECISION_NOW })
    ).resolves.toEqual({
      orderId: input.checkoutAttemptId,
      retryAllowed: false,
      status: "processing",
    });
    expect(query).toHaveBeenCalledOnce();
  });
});
