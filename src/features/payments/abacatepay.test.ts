import { describe, expect, it } from "vitest";
import {
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  mapAbacatePayEventToOrderStatus,
} from "./abacatepay";

describe("AbacatePay webhook mapping", () => {
  it("maps paid checkout events to paid orders", () => {
    expect(mapAbacatePayEventToOrderStatus("checkout.paid")).toBe("paid");
    expect(mapAbacatePayEventToOrderStatus("billing.paid")).toBe("paid");
  });

  it("maps refunded checkout events to refunded orders", () => {
    expect(mapAbacatePayEventToOrderStatus("checkout.refunded")).toBe(
      "refunded"
    );
    expect(mapAbacatePayEventToOrderStatus("transparent.refunded")).toBe(
      "refunded"
    );
  });

  it("builds an idempotency key from event id when present", () => {
    expect(
      getAbacatePayEventKey({ id: "evt_123", event: "checkout.paid" })
    ).toBe("evt_123");
  });

  it("extracts the external order payload from checkout events", () => {
    expect(
      getAbacatePayOrderPayload({
        event: "checkout.paid",
        data: {
          checkout: {
            id: "bill_123",
            externalId: "order_123",
            items: [{ id: "prod_protea" }],
            amount: 10_000,
            paidAmount: 10_000,
            methods: ["PIX"],
            receiptUrl: "https://example.com/receipt",
          },
          customer: {
            email: "aluna@example.com",
            name: "Aluna Teste",
          },
        },
      })
    ).toEqual({
      providerOrderId: "bill_123",
      externalId: "order_123",
      providerProductId: "prod_protea",
      amountInCents: 10_000,
      paidAmountInCents: 10_000,
      paymentMethod: "PIX",
      receiptUrl: "https://example.com/receipt",
      customerEmail: "aluna@example.com",
      customerName: "Aluna Teste",
    });
  });
});
