import { describe, expect, it } from "vitest";
import {
  getOrderTransition,
  getPaymentReviewRequired,
  resolveOrderStatus,
} from "./financial-policy";

describe("order status policy", () => {
  it("preserves the first terminal outcome", () => {
    expect(
      resolveOrderStatus({
        currentStatus: "refunded",
        incomingStatus: "disputed",
      })
    ).toBe("refunded");
    expect(
      resolveOrderStatus({
        currentStatus: "disputed",
        incomingStatus: "refunded",
      })
    ).toBe("disputed");
  });

  it("does not reopen refunded or disputed orders with a late paid event", () => {
    expect(
      resolveOrderStatus({
        currentStatus: "refunded",
        incomingStatus: "paid",
      })
    ).toBe("refunded");
    expect(
      resolveOrderStatus({
        currentStatus: "disputed",
        incomingStatus: "paid",
      })
    ).toBe("disputed");
  });

  it("does not revoke a paid order with a late cancellation", () => {
    expect(
      getOrderTransition({
        currentStatus: "paid",
        incomingStatus: "cancelled",
      })
    ).toEqual({
      finalOrderStatus: "paid",
      shouldApplyDisputeRevocation: false,
      shouldApplyPaidAccess: false,
      shouldApplyRefundRevocation: false,
    });
  });
});

describe("order effects policy", () => {
  it("grants access exactly once on the first paid event", () => {
    expect(
      getOrderTransition({
        currentStatus: "pending",
        incomingStatus: "paid",
      })
    ).toEqual({
      finalOrderStatus: "paid",
      shouldApplyDisputeRevocation: false,
      shouldApplyPaidAccess: true,
      shouldApplyRefundRevocation: false,
    });
    expect(
      getOrderTransition({
        currentStatus: "paid",
        incomingStatus: "paid",
      })
    ).toEqual({
      finalOrderStatus: "paid",
      shouldApplyDisputeRevocation: false,
      shouldApplyPaidAccess: false,
      shouldApplyRefundRevocation: false,
    });
  });

  it("applies refund revocation exactly once", () => {
    expect(
      getOrderTransition({
        currentStatus: "paid",
        incomingStatus: "refunded",
      }).shouldApplyRefundRevocation
    ).toBe(true);
    expect(
      getOrderTransition({
        currentStatus: "refunded",
        incomingStatus: "refunded",
      }).shouldApplyRefundRevocation
    ).toBe(false);
  });

  it("applies dispute revocation exactly once", () => {
    expect(
      getOrderTransition({
        currentStatus: "paid",
        incomingStatus: "disputed",
      }).shouldApplyDisputeRevocation
    ).toBe(true);
    expect(
      getOrderTransition({
        currentStatus: "disputed",
        incomingStatus: "disputed",
      }).shouldApplyDisputeRevocation
    ).toBe(false);
  });
});

describe("payment review policy", () => {
  it("opens a terminal conflict review for a conflicting terminal event", () => {
    expect(
      getPaymentReviewRequired({
        currentAmountInCents: 10_000,
        currentStatus: "refunded",
        incomingAmountInCents: 10_000,
        incomingStatus: "disputed",
      })
    ).toMatchObject({ type: "terminal_conflict" });
  });

  it("opens an amount mismatch review for a one-cent difference", () => {
    expect(
      getPaymentReviewRequired({
        currentAmountInCents: 10_000,
        currentStatus: "pending",
        incomingAmountInCents: 9999,
        incomingStatus: "paid",
      })
    ).toMatchObject({ type: "amount_mismatch" });
  });

  it("opens an amount mismatch review without an expected amount", () => {
    expect(
      getPaymentReviewRequired({
        currentAmountInCents: null,
        currentStatus: "pending",
        incomingAmountInCents: 10_000,
        incomingStatus: "paid",
      })
    ).toMatchObject({ type: "amount_mismatch" });
  });

  it("does not open a review for an exact paid amount", () => {
    expect(
      getPaymentReviewRequired({
        currentAmountInCents: 10_000,
        currentStatus: "pending",
        incomingAmountInCents: 10_000,
        incomingStatus: "paid",
      })
    ).toBeNull();
  });
});
