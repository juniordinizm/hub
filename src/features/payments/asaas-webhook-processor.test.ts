import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAsaasWebhookProcessor } from "./asaas-webhook-processor";
import type { AsaasWebhookProcessingContext } from "./asaas-webhook-worker";
import {
  LocalOrderIdentityError,
  type LocalOrderIdentityErrorCode,
} from "./order-identity";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const COURSE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "user-1";

const queryResult = (rows: unknown[]) => ({ rows });

const createOrderRow = (overrides: Record<string, unknown> = {}) => ({
  access_duration_months: 12,
  amount_in_cents: 12_990,
  checkout_status: "active",
  course_id: COURSE_ID,
  customer_email: null,
  customer_name: null,
  external_id: `order_${ORDER_ID}`,
  id: ORDER_ID,
  provider: "asaas",
  provider_checkout_id: "chk_1",
  provider_payment_id: null,
  provider_payment_status: null,
  provider_risk_status: null,
  status: "pending",
  user_id: USER_ID,
  ...overrides,
});

const createContext = ({
  correlationRows = [
    { id: ORDER_ID, match_kind: "payment_external_reference" },
  ],
  orderRow = createOrderRow(),
  orderRows,
  pendingReviewRows = [],
  persistOrder = true,
}: {
  correlationRows?: unknown[];
  orderRow?: unknown;
  orderRows?: unknown[];
  pendingReviewRows?: unknown[];
  persistOrder?: boolean;
} = {}) => {
  const pendingReviews = [...pendingReviewRows];
  const lockedOrderRows = orderRows ?? (orderRow ? [orderRow] : []);
  let lockedOrderReadCount = 0;
  const queries: Array<{ text: string; values: unknown[] | undefined }> = [];
  const query = vi.fn((text: string, values?: unknown[]) => {
    queries.push({ text, values });
    if (text.includes("with correlation_identifiers")) {
      return Promise.resolve(queryResult(correlationRows));
    }
    if (text.includes("from orders") && text.includes("where id = $1")) {
      const lockedOrder =
        lockedOrderRows[
          Math.min(lockedOrderReadCount, lockedOrderRows.length - 1)
        ];
      lockedOrderReadCount += 1;
      return Promise.resolve(queryResult(lockedOrder ? [lockedOrder] : []));
    }
    if (
      text.includes("from payment_reviews") &&
      text.includes("status = 'pending'")
    ) {
      return Promise.resolve(queryResult(pendingReviews));
    }
    if (text.includes("update orders")) {
      return Promise.resolve(
        queryResult(persistOrder ? [{ id: ORDER_ID }] : [])
      );
    }
    if (
      text.includes("update webhook_events") ||
      text.includes("update refund_requests") ||
      text.includes("insert into audit_logs")
    ) {
      return Promise.resolve(queryResult([{ id: values?.[0] ?? ORDER_ID }]));
    }
    if (text.includes("insert into payment_reviews")) {
      pendingReviews.push({ id: values?.[1] });
      return Promise.resolve(queryResult([{ id: values?.[1] }]));
    }
    return Promise.reject(
      new Error(`Unexpected SQL in processor test: ${text}`)
    );
  });
  const lockOrder = vi.fn(async () => undefined);
  const client = { query } as unknown as PoolClient;
  const context: AsaasWebhookProcessingContext = { client, lockOrder };
  return { context, lockOrder, pendingReviews, queries };
};

const createPaymentEvent = (
  event: string,
  paymentOverrides: Record<string, unknown> = {},
  id = EVENT_ID
) => ({
  attemptCount: 1,
  eventKey: `evt-${event}`,
  eventName: event,
  id,
  orderId: null,
  payload: {
    event,
    payment: {
      billingType: "PIX",
      checkoutSession: "chk_1",
      externalReference: `order_${ORDER_ID}`,
      id: "pay_1",
      status: "RECEIVED",
      value: 129.9,
      ...paymentOverrides,
    },
  },
});

describe("Asaas webhook processor", () => {
  it("locks the correlated order and grants PIX access with one outbox intent", async () => {
    const { context, lockOrder, queries } = createContext();
    const resolveIdentity = vi.fn(async () => ({
      activationRequired: false,
      userId: USER_ID,
    }));
    const applyPaidAccess = vi.fn(async () => undefined);
    const applyRevocation = vi.fn(async () => true);
    const enqueueMessage = vi.fn(async () => ({
      id: "outbox-1",
      inserted: true,
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation,
      enqueueMessage,
      now: () => new Date("2026-07-29T12:00:00.000Z"),
      resolveIdentity,
    });

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "processed" });

    expect(lockOrder).toHaveBeenCalledExactlyOnceWith(ORDER_ID);
    expect(resolveIdentity).toHaveBeenCalledOnce();
    expect(applyPaidAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        accessDurationMonths: 12,
        courseId: COURSE_ID,
        orderId: ORDER_ID,
        userId: USER_ID,
      })
    );
    expect(applyRevocation).not.toHaveBeenCalled();
    expect(enqueueMessage).toHaveBeenCalledWith({
      client: context.client,
      message: expect.objectContaining({
        aggregateId: ORDER_ID,
        idempotencyKey: `email.access-released/${ORDER_ID}/v1`,
      }),
    });
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("update orders") &&
          values?.includes("pay_1") &&
          values.includes("paid")
      )
    ).toBe(true);
  });

  it("creates one event-linked review and does not grant on amount mismatch", async () => {
    const { context, queries } = createContext();
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => new Date("2026-07-29T12:00:00.000Z"),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_RECEIVED", { value: 100 }),
      context
    );

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.filter(({ text }) => text.includes("insert into payment_reviews"))
    ).toHaveLength(1);
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "amount_mismatch", "amount_mismatch"]);
  });

  it("keeps a pending amount review blocking a later exact payment", async () => {
    const { context, pendingReviews, queries } = createContext();
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({
      id: "outbox-1",
      inserted: true,
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });

    await processor(
      createPaymentEvent("PAYMENT_RECEIVED", { value: 100 }),
      context
    );
    await processor(
      createPaymentEvent(
        "PAYMENT_RECEIVED",
        { value: 129.9 },
        "44444444-4444-4444-8444-444444444444"
      ),
      context
    );

    expect(pendingReviews).toHaveLength(1);
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries
        .filter(({ text }) => text.includes("update orders"))
        .every(({ values }) => !values?.includes("paid"))
    ).toBe(true);
  });

  it("keeps the order pending when the current paid authority is a status regression", async () => {
    const { context, pendingReviews, queries } = createContext({
      orderRows: [
        createOrderRow(),
        createOrderRow({ provider_payment_status: "RECEIVED" }),
      ],
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({
      id: "outbox-1",
      inserted: true,
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });

    await processor(
      createPaymentEvent("PAYMENT_RECEIVED", {
        billingType: "CREDIT_CARD",
        status: "RECEIVED",
      }),
      context
    );
    await processor(
      createPaymentEvent(
        "PAYMENT_CONFIRMED",
        { billingType: "CREDIT_CARD", status: "CONFIRMED" },
        "55555555-5555-4555-8555-555555555555"
      ),
      context
    );

    expect(pendingReviews).toHaveLength(1);
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries
        .filter(({ text }) => text.includes("update orders"))
        .every(({ values }) => !values?.includes("paid"))
    ).toBe(true);
  });

  it("does not choose an order when exact identifiers resolve ambiguously", async () => {
    const { context, lockOrder, queries } = createContext({
      correlationRows: [
        { id: ORDER_ID, match_kind: "external_reference" },
        {
          id: "44444444-4444-4444-8444-444444444444",
          match_kind: "provider_payment_id",
        },
      ],
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => new Date("2026-07-29T12:00:00.000Z"),
      resolveIdentity: vi.fn(),
    });

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "ignored" });

    expect(lockOrder).not.toHaveBeenCalled();
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("insert into audit_logs") &&
          values?.includes("ambiguous_identifiers")
      )
    ).toBe(true);
  });

  it("blocks a canonical external reference whose UUID differs from the selected order", async () => {
    const inconsistentOrderId = "55555555-5555-4555-8555-555555555555";
    const { context, lockOrder, queries } = createContext({
      correlationRows: [
        {
          id: inconsistentOrderId,
          match_kind: "payment_external_reference",
        },
      ],
      orderRow: createOrderRow({ id: inconsistentOrderId }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "processed" });

    expect(lockOrder).toHaveBeenCalledExactlyOnceWith(inconsistentOrderId);
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([
      inconsistentOrderId,
      EVENT_ID,
      "event_anomaly",
      "event_anomaly",
    ]);
  });

  it("ignores a known event without an exact local correlation and records a safe alert", async () => {
    const { context, lockOrder, queries } = createContext({
      correlationRows: [],
    });
    const processor = createAsaasWebhookProcessor();

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "ignored" });

    expect(lockOrder).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("insert into audit_logs") &&
          values?.includes("no_correlation")
      )
    ).toBe(true);
  });

  it("ignores a future unknown event without touching an order", async () => {
    const { context, lockOrder, queries } = createContext();
    const processor = createAsaasWebhookProcessor();

    await expect(
      processor(createPaymentEvent("PAYMENT_FUTURE_EVENT"), context)
    ).resolves.toEqual({ outcome: "ignored" });

    expect(lockOrder).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("insert into audit_logs") &&
          text.includes("jsonb_build_object('reason', $2::text)") &&
          values?.includes("unknown_event")
      )
    ).toBe(true);
  });

  it("opens an anomaly review when provider ID CAS detects a conflict", async () => {
    const { context, queries } = createContext({ persistOrder: false });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(createPaymentEvent("PAYMENT_RECEIVED"), context);

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
  });

  it("casts nullable provider identifiers before PostgreSQL null checks", async () => {
    const { context, queries } = createContext();
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });

    await processor(createPaymentEvent("PAYMENT_RECEIVED"), context);

    const update = queries.find(({ text }) =>
      text.includes("update orders")
    )?.text;
    expect(update).toContain("$2::text is null");
    expect(update).toContain("$3::text is null");
  });

  it("keeps card confirmation blocked while risk is awaiting analysis", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({
        provider_risk_status: "AWAITING_RISK_ANALYSIS",
      }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_CONFIRMED", {
        billingType: "CREDIT_CARD",
        status: "CONFIRMED",
      }),
      context
    );

    expect(applyPaidAccess).not.toHaveBeenCalled();
  });

  it("grants card access when later risk approval sees a stored confirmation", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({
        provider_payment_status: "CONFIRMED",
        provider_risk_status: "AWAITING_RISK_ANALYSIS",
      }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: "outbox-1", inserted: true })),
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });

    await processor(
      createPaymentEvent("PAYMENT_APPROVED_BY_RISK_ANALYSIS", {
        billingType: "CREDIT_CARD",
        status: "APPROVED_BY_RISK_ANALYSIS",
      }),
      context
    );

    expect(applyPaidAccess).toHaveBeenCalledOnce();
  });

  it("queues account activation for a public identity without calling auth directly", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({
        customer_email: "buyer@example.com",
        customer_name: "Buyer",
        user_id: null,
      }),
    });
    const enqueueMessage = vi.fn(async () => ({
      id: "outbox-1",
      inserted: true,
    }));
    const resolveIdentity = vi.fn(async () => ({
      activationRequired: true,
      userId: "public-user",
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });

    await processor(createPaymentEvent("PAYMENT_RECEIVED"), context);

    expect(resolveIdentity).toHaveBeenCalledWith({
      client: context.client,
      order: {
        customerEmail: "buyer@example.com",
        customerName: "Buyer",
        orderId: ORDER_ID,
        userId: null,
      },
    });
    expect(enqueueMessage).toHaveBeenCalledWith({
      client: context.client,
      message: expect.objectContaining({
        idempotencyKey: `auth.account-activation/${ORDER_ID}/v1`,
        payload: { orderId: ORDER_ID, userId: "public-user" },
      }),
    });
  });

  it("persists paid evidence and opens a review when the access snapshot is invalid", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ access_duration_months: null }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({
      id: null,
      inserted: false,
    }));
    const resolveIdentity = vi.fn();
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "processed" });

    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("update orders") && values?.includes("paid")
      )
    ).toBe(true);
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
  });

  it.each([
    "order_identity_conflict",
    "order_identity_incomplete",
    "order_user_not_found",
  ] satisfies LocalOrderIdentityErrorCode[])("persists paid evidence and reviews deterministic identity error %s", async (identityErrorCode) => {
    const { context, queries } = createContext();
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({
      id: null,
      inserted: false,
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity: vi.fn(() =>
        Promise.reject(new LocalOrderIdentityError(identityErrorCode))
      ),
    });

    await expect(
      processor(createPaymentEvent("PAYMENT_RECEIVED"), context)
    ).resolves.toEqual({ outcome: "processed" });

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("update orders") && values?.includes("paid")
      )
    ).toBe(true);
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
  });

  it.each([
    ["PAYMENT_REFUNDED", "payment_refund", "refunded"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "payment_dispute", "disputed"],
  ])("revokes access for %s and preserves the domain reason", async (eventName, expectedReason, expectedStatus) => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({
        id: null,
        inserted: false,
      })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent(eventName, { status: expectedStatus.toUpperCase() }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expectedReason, userId: USER_ID })
    );
    if (eventName === "PAYMENT_REFUNDED") {
      expect(
        queries.some(({ text }) => text.includes("update refund_requests"))
      ).toBe(true);
    }
  });

  it.each([
    ["PAYMENT_REFUNDED", "payment_refund"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "payment_dispute"],
  ])("keeps adverse %s authoritative while also reviewing an amount mismatch", async (eventName, expectedReason) => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({
        id: null,
        inserted: false,
      })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent(eventName, {
        status: "ADVERSE",
        value: 100,
      }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expectedReason })
    );
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "amount_mismatch", "amount_mismatch"]);
  });

  it.each([
    ["PAYMENT_REFUNDED", "payment_refund"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "payment_dispute"],
  ])("keeps adverse %s authoritative when amount evidence is missing", async (eventName, expectedReason) => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({
        id: null,
        inserted: false,
      })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent(eventName, {
        status: "ADVERSE",
        value: undefined,
      }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expectedReason })
    );
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
  });

  it("persists refund before payment and treats absent public identity/grant as a revocation no-op", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({
        customer_email: "buyer@example.com",
        customer_name: "Buyer",
        user_id: null,
      }),
    });
    const applyRevocation = vi.fn(async () => true);
    const resolveIdentity = vi.fn();
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity,
    });

    await processor(
      createPaymentEvent("PAYMENT_REFUNDED", {
        status: "REFUNDED",
        value: undefined,
      }),
      context
    );

    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(applyRevocation).not.toHaveBeenCalled();
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("update orders") && values?.includes("refunded")
      )
    ).toBe(true);
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
    expect(
      queries.some(({ text }) => text.includes("update refund_requests"))
    ).toBe(false);
  });

  it("confirms an exact full refund request despite another adverse terminal state", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "disputed" }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_REFUNDED", { status: "REFUNDED" }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "payment_dispute", userId: USER_ID })
    );
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "terminal_conflict", "terminal_conflict"]);
    expect(
      queries.some(({ text }) => text.includes("update refund_requests"))
    ).toBe(true);
  });

  it("persists exact textual Asaas refund evidence while confirming", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_REFUNDED", {
        refunds: [
          {
            dateCreated: "2026-07-29 10:19:06",
            endToEndIdentifier: "E123",
            status: "DONE",
            transactionReceiptUrl: "https://asaas.example/refund-receipt",
            value: 129.9,
          },
        ],
        status: "REFUNDED",
      }),
      context
    );

    const refundUpdate = queries.find(({ text }) =>
      text.includes("update refund_requests")
    );
    expect(refundUpdate?.values).toEqual([
      ORDER_ID,
      expect.any(Date),
      "DONE",
      "2026-07-29 10:19:06",
      "E123",
      "https://asaas.example/refund-receipt",
      12_990,
    ]);
  });

  it.each([
    ["disputed", "PAYMENT_REFUNDED", "REFUNDED", "payment_dispute"],
    ["refunded", "PAYMENT_CHARGEBACK_DISPUTE", "DISPUTE", "payment_refund"],
    ["cancelled", "PAYMENT_REFUNDED", "REFUNDED", "payment_refund"],
  ] as const)("revokes an active grant for adverse order %s on %s using the canonical reason", async (orderStatus, eventName, providerStatus, expectedReason) => {
    const { context } = createContext({
      orderRow: createOrderRow({ status: orderStatus }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent(eventName, { status: providerStatus }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expectedReason,
        userId: USER_ID,
      })
    );
  });

  it("does not duplicate revocation effects when the paid grant is already terminal", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({ status: "refunded" }),
    });
    const applyRevocation = vi.fn(async () => false);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_REFUNDED", { status: "REFUNDED" }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledOnce();
  });

  it("does not confirm a terminal-conflict refund request when amount evidence mismatches", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "disputed" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_REFUNDED", {
        status: "REFUNDED",
        value: 100,
      }),
      context
    );

    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "terminal_conflict", "terminal_conflict"]);
    expect(
      queries.some(({ text }) => text.includes("update refund_requests"))
    ).toBe(false);
  });

  it("records a partial-refund review without revoking access", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const applyRevocation = vi.fn(async () => true);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation,
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(
      createPaymentEvent("PAYMENT_PARTIALLY_REFUNDED", {
        status: "PARTIALLY_REFUNDED",
      }),
      context
    );

    expect(applyRevocation).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "partial_refund", "partial_refund"]);
  });

  it("does not reactivate a refunded order on a late paid event", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "refunded" }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processor(createPaymentEvent("PAYMENT_RECEIVED"), context);

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "terminal_conflict", "terminal_conflict"]);
  });
});
