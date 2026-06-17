import { describe, expect, it } from "vitest";
import {
  buildAbacatePayCheckoutRequest,
  buildAbacatePayProductRequest,
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  mapAbacatePayEventToOrderStatus,
  parsePriceToCents,
  verifyAbacatePaySignature,
  verifyAbacatePayWebhookSecret,
} from "./abacatepay";

const ABACATEPAY_WEBHOOK_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

describe("AbacatePay webhook mapping", () => {
  it("maps paid checkout events to paid orders", () => {
    expect(mapAbacatePayEventToOrderStatus("checkout.completed")).toBe("paid");
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
            metadata: { userId: "user_123" },
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
      userId: "user_123",
    });
  });
});

describe("AbacatePay webhook security", () => {
  it("accepts the configured webhook secret from AbacatePay", () => {
    expect(
      verifyAbacatePayWebhookSecret({
        expectedSecret: "webhook_secret",
        isProduction: true,
        receivedSecret: "webhook_secret",
      })
    ).toBe(true);
  });

  it("rejects invalid webhook secrets", () => {
    expect(
      verifyAbacatePayWebhookSecret({
        expectedSecret: "webhook_secret",
        isProduction: true,
        receivedSecret: "wrong",
      })
    ).toBe(false);
  });

  it("allows missing webhook secret only outside production", () => {
    expect(
      verifyAbacatePayWebhookSecret({
        expectedSecret: undefined,
        isProduction: false,
        receivedSecret: null,
      })
    ).toBe(true);
    expect(
      verifyAbacatePayWebhookSecret({
        expectedSecret: undefined,
        isProduction: true,
        receivedSecret: null,
      })
    ).toBe(false);
  });

  it("verifies current AbacatePay base64 HMAC signatures", async () => {
    const { createHmac } = await import("node:crypto");
    const payload = JSON.stringify({
      event: "checkout.completed",
      id: "log_1",
    });
    const signature = createHmac("sha256", ABACATEPAY_WEBHOOK_PUBLIC_HMAC_KEY)
      .update(Buffer.from(payload, "utf8"))
      .digest("base64");

    expect(
      verifyAbacatePaySignature({
        legacySecret: undefined,
        payload,
        signature,
      })
    ).toBe(true);
  });

  it("keeps legacy timestamp signatures supported for local CLI tooling", async () => {
    const { createHmac } = await import("node:crypto");
    const payload = JSON.stringify({ event: "billing.paid", id: "evt_1" });
    const timestamp = "1705849200";
    const hash = createHmac("sha256", "legacy_secret")
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(
      verifyAbacatePaySignature({
        legacySecret: "legacy_secret",
        payload,
        signature: `t=${timestamp},v1=${hash}`,
      })
    ).toBe(true);
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
