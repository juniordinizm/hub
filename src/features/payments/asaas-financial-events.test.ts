import { describe, expect, it } from "vitest";
import {
  type AsaasFinancialEventDecision,
  type AsaasFinancialOrderSnapshot,
  decideAsaasFinancialEvent,
} from "./asaas-financial-events";

const pendingOrder: AsaasFinancialOrderSnapshot = {
  amountInCents: 10_000,
  checkoutStatus: "active" as const,
  orderStatus: "pending" as const,
  providerPaymentStatus: null,
  providerRiskStatus: null,
};

describe("Asaas financial event matrix", () => {
  it.each([
    "cancelled",
    "expired",
  ] as const)("does not regress terminal checkout %s on late CHECKOUT_CREATED", (checkoutStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: {
        checkout: {
          externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
          id: "checkout_1",
          status: "ACTIVE",
        },
        event: "CHECKOUT_CREATED",
      },
      snapshot: { ...pendingOrder, checkoutStatus, orderStatus: "cancelled" },
    });

    expect(decision).toMatchObject({
      action: "apply",
      effect: "none",
      reviewReason: "event_anomaly",
      updates: { providerCheckoutStatus: "ACTIVE" },
    });
    expect(decision.updates.checkoutStatus).toBeUndefined();
  });

  it.each([
    "cancelled",
    "expired",
  ] as const)("reviews late CHECKOUT_PAID after terminal checkout %s without granting", (checkoutStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: {
        checkout: {
          externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
          id: "checkout_1",
          status: "PAID",
        },
        event: "CHECKOUT_PAID",
      },
      snapshot: { ...pendingOrder, checkoutStatus, orderStatus: "cancelled" },
    });

    expect(decision).toMatchObject({
      effect: "none",
      reviewReason: "event_anomaly",
      updates: { providerCheckoutStatus: "PAID" },
    });
    expect(decision.updates.checkoutStatus).toBeUndefined();
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it.each([
    ["cancelled", "CHECKOUT_EXPIRED", "EXPIRED"],
    ["expired", "CHECKOUT_CANCELED", "CANCELED"],
  ] as const)("preserves first terminal checkout %s when %s arrives later", (checkoutStatus, event, providerStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: {
        checkout: {
          externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
          id: "checkout_1",
          status: providerStatus,
        },
        event,
      },
      snapshot: { ...pendingOrder, checkoutStatus, orderStatus: "cancelled" },
    });

    expect(decision).toMatchObject({
      effect: "none",
      reviewReason: "terminal_conflict",
      updates: { providerCheckoutStatus: providerStatus },
    });
    expect(decision.updates.checkoutStatus).toBeUndefined();
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it.each([
    ["CHECKOUT_CANCELED", "cancelled", "CANCELED"],
    ["CHECKOUT_EXPIRED", "expired", "EXPIRED"],
  ] as const)("records late %s checkout evidence after payment without revoking the order", (event, checkoutStatus, providerStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: {
        checkout: {
          externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
          id: "checkout_1",
          status: providerStatus,
        },
        event,
      },
      snapshot: { ...pendingOrder, orderStatus: "paid" },
    });

    expect(decision).toMatchObject({
      effect: "none",
      reviewReason: null,
      updates: { checkoutStatus, providerCheckoutStatus: providerStatus },
    });
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it("ignores an unknown event with a safe alert and no financial effect", () => {
    expect(
      decideAsaasFinancialEvent({
        payload: {
          event: "PAYMENT_FUTURE_EVENT",
          id: "evt_future",
          payment: {
            billingType: "FUTURE_METHOD",
            checkoutSession: "chk_from_payment",
            externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
            id: "pay_future",
            status: "FUTURE_STATUS",
            value: 100,
          },
        },
        snapshot: pendingOrder,
      })
    ).toMatchObject({
      action: "ignore",
      alertReason: "unknown_event",
      correlation: {
        checkoutId: null,
        localOrderId: "123e4567-e89b-12d3-a456-426614174000",
        paymentCheckoutSession: "chk_from_payment",
        paymentId: "pay_future",
      },
      effect: "none",
      reviewReason: null,
      updates: {},
    });
  });

  it("extracts only exact provider identifiers and exact local order references", () => {
    expect(
      decideAsaasFinancialEvent({
        payload: {
          checkout: {
            externalReference: "order_123e4567-e89b-12d3-a456-426614174001",
            id: "checkout_1",
            status: "ACTIVE",
          },
          email: "must-not-correlate@example.com",
          event: "CHECKOUT_CREATED",
          id: "evt_checkout",
          payment: {
            checkoutSession: 123,
            externalReference: " order_123e4567-e89b-12d3-a456-426614174002 ",
            id: 456,
          },
        },
        snapshot: pendingOrder,
      }).correlation
    ).toEqual({
      checkoutExternalReference: "order_123e4567-e89b-12d3-a456-426614174001",
      checkoutId: "checkout_1",
      hasConflictingExternalReferences: false,
      localOrderId: "123e4567-e89b-12d3-a456-426614174001",
      paymentCheckoutSession: null,
      paymentExternalReference: " order_123e4567-e89b-12d3-a456-426614174002 ",
      paymentId: null,
    });
  });

  it("does not choose between conflicting exact local order references", () => {
    const decision = decideAsaasFinancialEvent({
      payload: {
        checkout: {
          externalReference: "order_123e4567-e89b-12d3-a456-426614174001",
          id: "checkout_1",
          status: "ACTIVE",
        },
        event: "PAYMENT_RECEIVED",
        id: "evt_checkout",
        payment: {
          billingType: "PIX",
          externalReference: "order_123e4567-e89b-12d3-a456-426614174002",
          id: "payment_1",
          status: "RECEIVED",
          value: 100,
        },
      },
      snapshot: pendingOrder,
    });

    expect(decision.correlation.localOrderId).toBeNull();
    expect(decision).toMatchObject({
      alertReason: "event_anomaly",
      effect: "none",
      reviewReason: "event_anomaly",
      updates: {},
    });
  });

  it("updates checkout state without granting on checkout events", () => {
    expect(
      decideAsaasFinancialEvent({
        payload: {
          checkout: { id: "checkout_1", status: "ACTIVE" },
          event: "CHECKOUT_CREATED",
          id: "evt_created",
        },
        snapshot: pendingOrder,
      })
    ).toMatchObject({
      action: "apply",
      effect: "none",
      reviewReason: null,
      updates: {
        checkoutStatus: "active",
        providerCheckoutStatus: "ACTIVE",
      },
    });

    expect(
      decideAsaasFinancialEvent({
        payload: {
          checkout: { id: "checkout_1", status: "PAID" },
          event: "CHECKOUT_PAID",
          id: "evt_paid",
        },
        snapshot: pendingOrder,
      })
    ).toMatchObject({
      action: "apply",
      effect: "none",
      updates: { providerCheckoutStatus: "PAID" },
    });
  });

  it("does not revoke paid orders for late checkout cancellation or expiration", () => {
    for (const event of ["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"]) {
      const decision = decideAsaasFinancialEvent({
        payload: {
          checkout: { id: "checkout_1", status: event },
          event,
          id: `evt_${event}`,
        },
        snapshot: { ...pendingOrder, orderStatus: "paid" },
      });

      expect(decision.effect).toBe("none");
      expect(decision.updates.orderStatus).toBeUndefined();
      expect(decision.reviewReason).toBeNull();
    }
  });

  it("grants PIX only on PAYMENT_RECEIVED with an exact amount", () => {
    const confirmed = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "PIX",
        event: "PAYMENT_CONFIRMED",
        status: "CONFIRMED",
        value: 100,
      }),
      snapshot: pendingOrder,
    });
    const received = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "PIX",
        event: "PAYMENT_RECEIVED",
        status: "RECEIVED",
        value: 100,
      }),
      snapshot: pendingOrder,
    });

    expect(confirmed.effect).toBe("none");
    expect(received).toMatchObject({
      action: "apply",
      effect: "grant",
      reviewReason: null,
      updates: {
        orderStatus: "paid",
        paidAmountInCents: 10_000,
        paymentMethod: "PIX",
        providerPaymentStatus: "RECEIVED",
      },
    });
  });

  it("derives net and fee evidence from the payment payload", () => {
    const basePayload = paymentPayload({
      billingType: "PIX",
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      value: 100,
    });
    const payload = {
      ...basePayload,
      payment: { ...basePayload.payment, netValue: 97.01 },
    };

    const decision = decideAsaasFinancialEvent({
      payload,
      snapshot: pendingOrder,
    });

    expect(decision.updates).toMatchObject({
      feeAmountInCents: 299,
      netAmountInCents: 9701,
    });
  });

  it("grants card only on PAYMENT_CONFIRMED and treats receipt as settlement", () => {
    const confirmed = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_CONFIRMED",
        status: "CONFIRMED",
        value: 100,
      }),
      snapshot: pendingOrder,
    });
    const received = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_RECEIVED",
        status: "RECEIVED",
        value: 100,
      }),
      snapshot: pendingOrder,
    });

    expect(confirmed.effect).toBe("grant");
    expect(confirmed.updates.orderStatus).toBe("paid");
    expect(received.effect).toBe("none");
    expect(received.updates.orderStatus).toBeUndefined();
    expect(received.updates.providerSettlementStatus).toBe("RECEIVED");
  });

  it("never grants while card risk analysis is pending", () => {
    expect(
      decideAsaasFinancialEvent({
        payload: paymentPayload({
          billingType: "CREDIT_CARD",
          event: "PAYMENT_AWAITING_RISK_ANALYSIS",
          status: "AWAITING_RISK_ANALYSIS",
          value: 100,
        }),
        snapshot: pendingOrder,
      })
    ).toMatchObject({
      effect: "none",
      updates: {
        providerRiskStatus: "AWAITING_RISK_ANALYSIS",
      },
    });
  });

  it("records confirmation without review while risk is awaiting", () => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_CONFIRMED",
        status: "CONFIRMED",
        value: 100,
      }),
      snapshot: {
        ...pendingOrder,
        providerRiskStatus: "AWAITING_RISK_ANALYSIS",
      },
    });

    expect(decision.effect).toBe("none");
    expect(decision.alertReason).toBeNull();
    expect(decision.reviewReason).toBeNull();
    expect(decision.updates.providerPaymentStatus).toBe("CONFIRMED");
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it("blocks and reviews confirmation after risk reproval", () => {
    const decision = decideAsaasFinancialEvent({
      payload: cardPayload("PAYMENT_CONFIRMED", "CONFIRMED"),
      snapshot: {
        ...pendingOrder,
        providerRiskStatus: "REPROVED_BY_RISK_ANALYSIS",
      },
    });

    expect(decision.effect).toBe("none");
    expect(decision.reviewReason).toBe("event_anomaly");
    expect(decision.updates.providerPaymentStatus).toBe("CONFIRMED");
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it.each([
    { name: "A-P-C", steps: ["A", "P", "C"] },
    { name: "A-C-P", steps: ["A", "C", "P"] },
    { name: "P-A-C", steps: ["P", "A", "C"] },
    { name: "P-C-A", steps: ["P", "C", "A"] },
    { name: "C-A-P", steps: ["C", "A", "P"] },
    { name: "C-P-A", steps: ["C", "P", "A"] },
  ] as const)("converges $name with duplicates to exactly one grant", ({
    name,
    steps,
  }) => {
    const payloads = steps.flatMap((step) => [
      getCardStepPayload(step),
      getCardStepPayload(step),
    ]);
    const result = runCardSequence(payloads);

    expect(result.grantCount).toBe(1);
    expect(result.snapshot.orderStatus).toBe("paid");
    if (name === "P-A-C") {
      expect(result.snapshot.providerRiskStatus).toBe(
        "APPROVED_BY_RISK_ANALYSIS"
      );
    }
  });

  it("keeps A-C review-free and lets subsequent P grant", () => {
    const result = runCardSequence([
      getCardStepPayload("A"),
      getCardStepPayload("C"),
      getCardStepPayload("P"),
    ]);

    expect(result.decisions[1]).toMatchObject({
      alertReason: null,
      effect: "none",
      reviewReason: null,
      updates: { providerPaymentStatus: "CONFIRMED" },
    });
    expect(result.decisions[2]?.effect).toBe("grant");
    expect(result.grantCount).toBe(1);
  });

  it.each([
    {
      expectedGrantCount: 1,
      expectedRiskStatus: "APPROVED_BY_RISK_ANALYSIS",
      first: "P",
      second: "R",
    },
    {
      expectedGrantCount: 0,
      expectedRiskStatus: "REPROVED_BY_RISK_ANALYSIS",
      first: "R",
      second: "P",
    },
  ] as const)("preserves the first terminal risk for $first-$second-C", ({
    expectedGrantCount,
    expectedRiskStatus,
    first,
    second,
  }) => {
    const result = runCardSequence([
      getCardStepPayload(first),
      getCardStepPayload(second),
      getCardStepPayload("C"),
    ]);
    const conflict = result.decisions[1];

    expect(conflict).toMatchObject({
      effect: "none",
      reviewReason: "terminal_conflict",
    });
    expect(conflict?.updates.providerRiskStatus).toBeUndefined();
    expect(result.snapshot.providerRiskStatus).toBe(expectedRiskStatus);
    expect(result.grantCount).toBe(expectedGrantCount);
  });

  it("does not grant risk approval without recorded card confirmation", () => {
    const result = runCardSequence([
      riskPayload(
        "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
        "APPROVED_BY_RISK_ANALYSIS"
      ),
      riskPayload(
        "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
        "APPROVED_BY_RISK_ANALYSIS"
      ),
    ]);

    expect(result.grantCount).toBe(0);
    expect(result.snapshot.orderStatus).toBe("pending");
  });

  it("treats late pending risk after confirmation as a non-revoking regression", () => {
    const result = runCardSequence([
      cardPayload("PAYMENT_CONFIRMED", "CONFIRMED"),
      cardPayload("PAYMENT_CONFIRMED", "CONFIRMED"),
      riskPayload("PAYMENT_AWAITING_RISK_ANALYSIS", "AWAITING_RISK_ANALYSIS"),
      riskPayload("PAYMENT_AWAITING_RISK_ANALYSIS", "AWAITING_RISK_ANALYSIS"),
    ]);
    const lateRiskDecisions = result.decisions.slice(2);

    expect(result.grantCount).toBe(1);
    expect(result.snapshot.orderStatus).toBe("paid");
    for (const decision of lateRiskDecisions) {
      expect(decision.effect).toBe("none");
      expect(decision.reviewReason).toBe("event_anomaly");
      expect(decision.updates.orderStatus).toBeUndefined();
    }
  });

  it.each([
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_REFUND_DENIED",
  ])("records %s as refund evidence without a financial transition", (event) => {
    for (const orderStatus of [
      "pending",
      "paid",
      "refunded",
      "disputed",
    ] as const) {
      const decision = decideAsaasFinancialEvent({
        payload: paymentPayload({
          billingType: "CREDIT_CARD",
          event,
          status: event.replace("PAYMENT_", ""),
          value: 100,
        }),
        snapshot: { ...pendingOrder, orderStatus },
      });

      expect(decision.effect).toBe("none");
      expect(decision.reviewReason).toBeNull();
      expect(decision.updates.orderStatus).toBeUndefined();
      expect(decision.updates.providerRefundStatus).toBe(
        event.replace("PAYMENT_", "")
      );
    }
  });

  it.each([
    null,
    "APPROVED_BY_RISK_ANALYSIS",
  ])("confirms card when snapshot risk is %s", (providerRiskStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_CONFIRMED",
        status: "CONFIRMED",
        value: 100,
      }),
      snapshot: { ...pendingOrder, providerRiskStatus },
    });

    expect(decision.effect).toBe("grant");
    expect(decision.reviewReason).toBeNull();
  });

  it.each([
    ["PAYMENT_AWAITING_RISK_ANALYSIS", "AWAITING_RISK_ANALYSIS"],
    ["PAYMENT_REPROVED_BY_RISK_ANALYSIS", "REPROVED_BY_RISK_ANALYSIS"],
  ])("reviews %s after payment without revoking", (event, providerRiskStatus) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event,
        status: providerRiskStatus,
        value: 100,
      }),
      snapshot: { ...pendingOrder, orderStatus: "paid" },
    });

    expect(decision.effect).toBe("none");
    expect(decision.reviewReason).toBe("event_anomaly");
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it.each([
    { expected: "amount_mismatch", value: 99.99 },
    { expected: "event_anomaly", value: 100.001 },
    { expected: "event_anomaly", value: "100" },
  ])("does not grant when payment value requires $expected review", ({
    expected,
    value,
  }) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "PIX",
        event: "PAYMENT_RECEIVED",
        status: "RECEIVED",
        value,
      }),
      snapshot: pendingOrder,
    });

    expect(decision.effect).toBe("none");
    expect(decision.updates.orderStatus).toBeUndefined();
    expect(decision.reviewReason).toBe(expected);
  });

  it("converts decimal provider values to exact safe cents", () => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "PIX",
        event: "PAYMENT_RECEIVED",
        status: "RECEIVED",
        value: 0.29,
      }),
      snapshot: { ...pendingOrder, amountInCents: 29 },
    });

    expect(decision.effect).toBe("grant");
    expect(decision.updates.paidAmountInCents).toBe(29);
  });

  it("revokes for refunds and dispute-family events", () => {
    const events = [
      ["PAYMENT_REFUNDED", "refunded", "providerRefundStatus"],
      ["PAYMENT_CHARGEBACK_REQUESTED", "disputed", "providerDisputeStatus"],
      ["PAYMENT_CHARGEBACK_DISPUTE", "disputed", "providerDisputeStatus"],
      [
        "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
        "disputed",
        "providerDisputeStatus",
      ],
    ] as const;

    for (const [event, orderStatus, providerStatusField] of events) {
      const decision = decideAsaasFinancialEvent({
        payload: paymentPayload({
          billingType: "CREDIT_CARD",
          event,
          status: event,
          value: 100,
        }),
        snapshot: { ...pendingOrder, orderStatus: "paid" },
      });

      expect(decision.effect).toBe("revoke");
      expect(decision.updates.orderStatus).toBe(orderStatus);
      expect(decision.updates[providerStatusField]).toBe(event);
    }
  });

  it.each([
    { alertReason: null, value: 100 },
    { alertReason: null, value: 99.99 },
    { alertReason: "event_anomaly", value: 100.001 },
  ])("always requires partial refund review for value $value", ({
    alertReason,
    value,
  }) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_PARTIALLY_REFUNDED",
        status: "PARTIALLY_REFUNDED",
        value,
      }),
      snapshot: { ...pendingOrder, orderStatus: "paid" },
    });

    expect(decision.alertReason).toBe(alertReason);
    expect(decision.effect).toBe("none");
    expect(decision.reviewReason).toBe("partial_refund");
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it("preserves adverse terminal states on late paid events and reviews conflicts", () => {
    for (const orderStatus of ["refunded", "disputed"] as const) {
      const decision = decideAsaasFinancialEvent({
        payload: paymentPayload({
          billingType: "PIX",
          event: "PAYMENT_RECEIVED",
          status: "RECEIVED",
          value: 100,
        }),
        snapshot: { ...pendingOrder, orderStatus },
      });

      expect(decision.effect).toBe("none");
      expect(decision.reviewReason).toBe("terminal_conflict");
      expect(decision.updates.orderStatus).toBeUndefined();
    }
  });

  it.each([
    ["refunded", "PAYMENT_CHARGEBACK_DISPUTE", "DISPUTE", "terminal_conflict"],
    ["disputed", "PAYMENT_REFUNDED", "REFUNDED", "terminal_conflict"],
    ["cancelled", "PAYMENT_REFUNDED", "REFUNDED", "terminal_conflict"],
    ["refunded", "PAYMENT_REFUNDED", "REFUNDED", null],
  ] as const)("preserves adverse order %s while still requesting revocation for %s", (orderStatus, event, status, reviewReason) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event,
        status,
        value: 100,
      }),
      snapshot: { ...pendingOrder, orderStatus },
    });

    expect(decision.effect).toBe("revoke");
    expect(decision.reviewReason).toBe(reviewReason);
    expect(decision.updates.orderStatus).toBeUndefined();
  });

  it("still revokes an adverse event with an amount mismatch and opens review", () => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType: "CREDIT_CARD",
        event: "PAYMENT_REFUNDED",
        status: "REFUNDED",
        value: 99.99,
      }),
      snapshot: { ...pendingOrder, orderStatus: "paid" },
    });

    expect(decision.effect).toBe("revoke");
    expect(decision.reviewReason).toBe("amount_mismatch");
    expect(decision.updates.orderStatus).toBe("refunded");
  });

  it.each([
    [
      "paid",
      "RECEIVED",
      "PAYMENT_CONFIRMED",
      "CONFIRMED",
      "CREDIT_CARD",
      undefined,
      "event_anomaly",
      "none",
    ],
    [
      "paid",
      "RECEIVED",
      "PAYMENT_OVERDUE",
      "OVERDUE",
      "PIX",
      undefined,
      "event_anomaly",
      "none",
    ],
    [
      "disputed",
      "RECEIVED",
      "PAYMENT_DELETED",
      "PENDING",
      "PIX",
      undefined,
      "event_anomaly",
      "none",
    ],
    [
      "paid",
      "CONFIRMED",
      "PAYMENT_RECEIVED",
      "RECEIVED",
      "CREDIT_CARD",
      "RECEIVED",
      null,
      "none",
    ],
    [
      "paid",
      "RECEIVED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "CHARGEBACK_REQUESTED",
      "CREDIT_CARD",
      "CHARGEBACK_REQUESTED",
      null,
      "revoke",
    ],
    [
      "paid",
      "RECEIVED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PENDING",
      "CREDIT_CARD",
      undefined,
      "event_anomaly",
      "revoke",
    ],
  ] as const)("applies provider payment precedence from %s/%s on %s", (orderStatus, providerPaymentStatus, event, incomingStatus, billingType, expectedStatus, reviewReason, effect) => {
    const decision = decideAsaasFinancialEvent({
      payload: paymentPayload({
        billingType,
        event,
        status: incomingStatus,
        value: 100,
      }),
      snapshot: {
        ...pendingOrder,
        orderStatus,
        providerPaymentStatus,
      },
    });

    expect(decision.effect).toBe(effect);
    expect(decision.reviewReason).toBe(reviewReason);
    expect(decision.updates.providerPaymentStatus).toBe(expectedStatus);
  });

  it("reviews regressive payment state after payment without revoking", () => {
    for (const event of ["PAYMENT_OVERDUE", "PAYMENT_DELETED"]) {
      const decision = decideAsaasFinancialEvent({
        payload: paymentPayload({
          billingType: "FUTURE_BILLING_TYPE",
          event,
          status: `FUTURE_${event}`,
          value: 100,
        }),
        snapshot: { ...pendingOrder, orderStatus: "paid" },
      });

      expect(decision.effect).toBe("none");
      expect(decision.reviewReason).toBe("event_anomaly");
      expect(decision.updates).toMatchObject({
        paymentMethod: "FUTURE_BILLING_TYPE",
      });
      expect(decision.updates.providerPaymentStatus).toBeUndefined();
      expect(decision.updates.orderStatus).toBeUndefined();
    }
  });
});

const paymentPayload = ({
  billingType,
  event,
  status,
  value,
}: {
  billingType: string;
  event: string;
  status: string;
  value: unknown;
}) => ({
  event,
  id: `evt_${event}`,
  payment: {
    billingType,
    checkoutSession: "checkout_1",
    externalReference: "order_123e4567-e89b-12d3-a456-426614174000",
    id: "payment_1",
    status,
    value,
  },
});

const cardPayload = (event: string, status: string) =>
  paymentPayload({
    billingType: "CREDIT_CARD",
    event,
    status,
    value: 100,
  });

const riskPayload = cardPayload;

type CardStep = "A" | "C" | "P" | "R";

const getCardStepPayload = (step: CardStep): unknown => {
  if (step === "A") {
    return riskPayload(
      "PAYMENT_AWAITING_RISK_ANALYSIS",
      "AWAITING_RISK_ANALYSIS"
    );
  }
  if (step === "P") {
    return riskPayload(
      "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
      "APPROVED_BY_RISK_ANALYSIS"
    );
  }
  if (step === "R") {
    return riskPayload(
      "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
      "REPROVED_BY_RISK_ANALYSIS"
    );
  }
  return cardPayload("PAYMENT_CONFIRMED", "CONFIRMED");
};

const applyDecisionToSnapshot = (
  snapshot: AsaasFinancialOrderSnapshot,
  decision: AsaasFinancialEventDecision
): AsaasFinancialOrderSnapshot => ({
  ...snapshot,
  checkoutStatus: decision.updates.checkoutStatus ?? snapshot.checkoutStatus,
  orderStatus: decision.updates.orderStatus ?? snapshot.orderStatus,
  providerPaymentStatus:
    decision.updates.providerPaymentStatus ?? snapshot.providerPaymentStatus,
  providerRiskStatus:
    decision.updates.providerRiskStatus ?? snapshot.providerRiskStatus,
});

const runCardSequence = (
  payloads: unknown[]
): {
  decisions: AsaasFinancialEventDecision[];
  grantCount: number;
  snapshot: AsaasFinancialOrderSnapshot;
} => {
  let snapshot = pendingOrder;
  const decisions: AsaasFinancialEventDecision[] = [];
  let grantCount = 0;

  for (const payload of payloads) {
    const decision = decideAsaasFinancialEvent({ payload, snapshot });
    decisions.push(decision);
    if (decision.effect === "grant") {
      grantCount += 1;
    }
    snapshot = applyDecisionToSnapshot(snapshot, decision);
  }

  return { decisions, grantCount, snapshot };
};
