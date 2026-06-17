import { describe, expect, it } from "vitest";
import {
  buildAbacatePayCheckoutRequest,
  buildAbacatePayProductRequest,
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  mapAbacatePayEventToOrderStatus,
  parsePriceToCents,
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

describe("AbacatePay v2 requests", () => {
  it("parses BRL prices into cents without floating point drift", () => {
    expect(parsePriceToCents("497")).toBe(49_700);
    expect(parsePriceToCents("497,90")).toBe(49_790);
    expect(parsePriceToCents("1.497")).toBe(149_700);
    expect(parsePriceToCents("1.497,90")).toBe(149_790);
    expect(parsePriceToCents("R$ 1.497,90")).toBe(149_790);
  });

  it("rejects invalid course prices", () => {
    expect(() => parsePriceToCents("")).toThrow("Preco do curso invalido.");
    expect(() => parsePriceToCents("0")).toThrow("Preco do curso invalido.");
    expect(() => parsePriceToCents("-10")).toThrow("Preco do curso invalido.");
  });

  it("builds a v2 product payload for a one-time course product", () => {
    expect(
      buildAbacatePayProductRequest({
        courseId: "course_123",
        description: "Descricao do curso",
        imageUrl: "/protear/capa.png",
        priceInCents: 49_790,
        title: "Curso PROTEA-R",
      })
    ).toEqual({
      currency: "BRL",
      description: "Descricao do curso",
      externalId: "course_123",
      name: "Curso PROTEA-R",
      price: 49_790,
    });
  });

  it("sends product imageUrl only when it is a public URL", () => {
    expect(
      buildAbacatePayProductRequest({
        courseId: "course_123",
        description: null,
        imageUrl: "https://example.com/course.png",
        priceInCents: 49_790,
        title: "Curso PROTEA-R",
      })
    ).toMatchObject({
      imageUrl: "https://example.com/course.png",
    });
  });

  it("builds a checkout payload for a single course purchase", () => {
    expect(
      buildAbacatePayCheckoutRequest({
        completionUrl: "https://example.com/app/checkout/sucesso",
        courseId: "course_123",
        externalId: "order_123",
        productId: "prod_123",
        returnUrl: "https://example.com/app",
        userId: "user_123",
      })
    ).toEqual({
      completionUrl: "https://example.com/app/checkout/sucesso",
      externalId: "order_123",
      frequency: "ONE_TIME",
      items: [{ id: "prod_123", quantity: 1 }],
      metadata: {
        courseId: "course_123",
        userId: "user_123",
      },
      methods: ["PIX", "CARD"],
      returnUrl: "https://example.com/app",
    });
  });
});
