import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AsaasGatewayError } from "./asaas-client";
import {
  type AsaasBuyerIdentityPreparation,
  prepareAsaasBuyerIdentity,
} from "./asaas-customer-enrichment";
import {
  AsaasWebhookProcessingError,
  type ClaimedAsaasWebhookEvent,
} from "./asaas-webhook-worker";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";

const normalizeSql = (sql: unknown): string =>
  String(sql).replace(/\s+/g, " ").trim().toLowerCase();

const createEvent = (
  options: {
    billingType?: string;
    customer?: unknown;
    eventName?: string;
    orderId?: string | null;
    payloadEvent?: string;
    paymentOverrides?: Record<string, unknown>;
  } = {}
): ClaimedAsaasWebhookEvent => ({
  attemptCount: 1,
  eventKey: "evt_1",
  eventName: options.eventName ?? "PAYMENT_RECEIVED",
  id: "event-1",
  orderId: options.orderId === undefined ? ORDER_ID : options.orderId,
  payload: {
    event: options.payloadEvent ?? options.eventName ?? "PAYMENT_RECEIVED",
    id: "evt_1",
    payment: {
      billingType: options.billingType ?? "PIX",
      checkoutSession: "checkout-1",
      customer: "customer" in options ? options.customer : "cus_123",
      externalReference: `order_${ORDER_ID}`,
      id: "payment-1",
      status:
        options.eventName === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "RECEIVED",
      value: 129.9,
      ...options.paymentOverrides,
    },
  },
});

const createGatewayError = (
  kind: ConstructorParameters<typeof AsaasGatewayError>[0]["kind"],
  retryable: boolean
): AsaasGatewayError =>
  new AsaasGatewayError({
    kind,
    message: "provider message with buyer@example.com",
    outcome: "rejected",
    retryable,
  });

const createDependencies = ({
  rows = [{ buyerIdentityStatus: "pending", id: ORDER_ID }],
}: {
  rows?: { buyerIdentityStatus?: string; id: string }[];
} = {}) => {
  const query = vi.fn().mockResolvedValue({ rows });
  const getCustomer = vi.fn().mockResolvedValue({
    email: " Buyer@Example.com ",
    id: "cus_123",
    name: " Compradora ",
  });
  return {
    client: { query } as never,
    gateway: { getCustomer },
    getCustomer,
    query,
  };
};

describe("prepareAsaasBuyerIdentity", () => {
  it.each([
    ["PAYMENT_RECEIVED", "PIX"],
    ["PAYMENT_CONFIRMED", "CREDIT_CARD"],
  ])("resolves a pending public order for authoritative %s/%s", async (eventName, billingType) => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({ billingType, eventName }),
      })
    ).resolves.toEqual({
      customerId: "cus_123",
      identity: { email: "buyer@example.com", name: "Compradora" },
      kind: "resolved",
      orderId: ORDER_ID,
    } satisfies AsaasBuyerIdentityPreparation);

    const sql = normalizeSql(dependencies.query.mock.calls[0]?.[0]);
    expect(sql).toContain('buyer_identity_status as "buyeridentitystatus"');
    expect(sql).toContain("provider = 'asaas'");
    expect(sql).not.toContain("for update");
    expect(sql).toContain(
      "and (provider_payment_id is null or provider_payment_id = $6)"
    );
    expect(sql).toContain(
      "or ($6::text is not null and provider_payment_id = $6)"
    );
    expect(dependencies.query.mock.calls[0]?.[1]).toEqual([
      ORDER_ID,
      null,
      `order_${ORDER_ID}`,
      null,
      "checkout-1",
      "payment-1",
    ]);
    expect(dependencies.getCustomer).toHaveBeenCalledWith("cus_123");
  });

  it("requires a persisted matching payment id when no checkout or reference anchor exists", async () => {
    const dependencies = createDependencies({ rows: [] });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({
          paymentOverrides: {
            checkoutSession: undefined,
            externalReference: undefined,
          },
        }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    const sql = normalizeSql(dependencies.query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "or ($6::text is not null and provider_payment_id = $6)"
    );
    expect(dependencies.query.mock.calls[0]?.[1]).toEqual([
      ORDER_ID,
      null,
      null,
      null,
      null,
      "payment-1",
    ]);
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("rejects an already persisted divergent payment id", async () => {
    const dependencies = createDependencies({ rows: [] });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({ kind: "not_required" });

    const sql = normalizeSql(dependencies.query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "and (provider_payment_id is null or provider_payment_id = $6)"
    );
    expect(dependencies.query.mock.calls[0]?.[1]?.[5]).toBe("payment-1");
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it.each([
    ["PAYMENT_RECEIVED", "CREDIT_CARD"],
    ["PAYMENT_CONFIRMED", "PIX"],
    ["PAYMENT_REFUNDED", "PIX"],
    ["CHECKOUT_PAID", "PIX"],
    ["PAYMENT_OVERDUE", "PIX"],
  ])("does not query identity for non-grant event %s/%s", async (eventName, billingType) => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({ billingType, eventName }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [] },
    {
      rows: [
        { buyerIdentityStatus: "pending", id: ORDER_ID },
        { buyerIdentityStatus: "resolved", id: "order-2" },
      ],
    },
  ])("does not call Asaas when correlation does not yield exactly one pending order", async ({
    rows,
  }) => {
    const dependencies = createDependencies({ rows });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    "",
    "   ",
  ])("requires a non-empty exact payment.customer after pending correlation", async (customer) => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({ customer }),
      })
    ).resolves.toEqual({
      customerId: null,
      kind: "review_required",
      orderId: ORDER_ID,
      reason: "buyer_identity_missing",
    });

    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("does not let event.orderId select a candidate for a malformed payload reference", async () => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({
          paymentOverrides: {
            externalReference: "malformed-order-reference",
          },
        }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("does not fetch PII when event.orderId and payload order reference diverge", async () => {
    const dependencies = createDependencies();
    const otherOrderId = "00000000-0000-4000-8000-000000000002";

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({
          paymentOverrides: {
            externalReference: `order_${otherOrderId}`,
          },
        }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("does not query when the payload has no correlatable identifier", async () => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({
          paymentOverrides: {
            checkoutSession: undefined,
            externalReference: undefined,
            id: undefined,
          },
        }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("does not query when payload.event diverges from the claimed event", async () => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({ payloadEvent: "PAYMENT_CONFIRMED" }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it.each([
    ["missing id", { id: undefined }],
    ["empty id", { id: "" }],
    ["missing status", { status: undefined }],
    ["empty status", { status: "" }],
    ["incompatible status", { status: "CONFIRMED" }],
    ["missing value", { value: undefined }],
    ["invalid value", { value: "129.999" }],
    ["missing billing type", { billingType: undefined }],
    ["empty billing type", { billingType: "" }],
  ] as const)("does not query for malformed grant payload: %s", async (_label, paymentOverrides) => {
    const dependencies = createDependencies();

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent({ paymentOverrides }),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("rejects a customer response correlated to another id", async () => {
    const dependencies = createDependencies();
    dependencies.getCustomer.mockResolvedValue({
      email: "buyer@example.com",
      id: "cus_other",
      name: "Compradora",
    });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({
      customerId: "cus_123",
      kind: "review_required",
      orderId: ORDER_ID,
      reason: "buyer_identity_conflict",
    });
  });

  it("rejects an invalid customer identity", async () => {
    const dependencies = createDependencies();
    dependencies.getCustomer.mockResolvedValue({
      email: "not-an-email",
      id: "cus_123",
      name: "Compradora",
    });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({
      customerId: "cus_123",
      kind: "review_required",
      orderId: ORDER_ID,
      reason: "buyer_identity_invalid",
    });
  });

  it.each([
    ["not_found", "buyer_identity_missing"],
    ["invalid_response", "buyer_identity_invalid"],
  ] as const)("maps %s to review-required %s", async (kind, reason) => {
    const dependencies = createDependencies();
    dependencies.getCustomer.mockRejectedValue(createGatewayError(kind, false));

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({
      customerId: "cus_123",
      kind: "review_required",
      orderId: ORDER_ID,
      reason,
    });
  });

  it("does not call Asaas for one correlated authenticated or resolved order", async () => {
    const dependencies = createDependencies({
      rows: [{ buyerIdentityStatus: "resolved", id: ORDER_ID }],
    });

    await expect(
      prepareAsaasBuyerIdentity({
        ...dependencies,
        event: createEvent(),
      })
    ).resolves.toEqual({ kind: "not_required" });

    expect(dependencies.getCustomer).not.toHaveBeenCalled();
  });

  it("preserves safe gateway classification and retryability", async () => {
    const dependencies = createDependencies();
    dependencies.getCustomer.mockRejectedValue(
      createGatewayError("rate_limited", true)
    );

    const result = prepareAsaasBuyerIdentity({
      ...dependencies,
      event: createEvent(),
    });

    await expect(result).rejects.toBeInstanceOf(AsaasWebhookProcessingError);
    await expect(result).rejects.toMatchObject({
      code: "asaas_customer_rate_limited",
      message: "asaas_customer_rate_limited",
      retryable: true,
    });
  });

  it("sanitizes unknown provider failures as retryable", async () => {
    const dependencies = createDependencies();
    dependencies.getCustomer.mockRejectedValue(
      new Error("buyer@example.com private provider message")
    );

    const result = prepareAsaasBuyerIdentity({
      ...dependencies,
      event: createEvent(),
    });

    await expect(result).rejects.toMatchObject({
      code: "asaas_customer_lookup_failed",
      message: "asaas_customer_lookup_failed",
      retryable: true,
    });
  });
});
