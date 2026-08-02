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
const NOW = new Date("2026-07-30T15:00:00.000Z");
const IDENTITY_PREPARATION_CAS_PATTERN =
  /user_id is null[\s\S]*buyer_identity_status = 'pending'[\s\S]*provider_customer_id is null[\s\S]*customer_name is null[\s\S]*customer_email is null/i;
const IDENTITY_REVIEW_PENDING_PATTERN =
  /buyer_identity_status\s*=\s*'pending'/i;
const IDENTITY_REVIEW_RESOLVED_CAS_PATTERN =
  /buyer_identity_status\s+in\s*\(\s*'pending'\s*,\s*'resolved'\s*\)/i;

const queryResult = (rows: unknown[]) => ({ rows });

const createOrderRow = (overrides: Record<string, unknown> = {}) => ({
  access_duration_months: 12,
  amount_in_cents: 12_990,
  buyer_identity_status: "resolved",
  checkout_status: "active",
  course_id: COURSE_ID,
  customer_email: null,
  customer_name: null,
  external_id: `order_${ORDER_ID}`,
  id: ORDER_ID,
  provider: "asaas",
  provider_checkout_id: "chk_1",
  provider_customer_id: null,
  provider_installment_id: null,
  provider_payment_id: null,
  provider_payment_status: null,
  provider_risk_status: null,
  payment_allow_credit_card: true,
  payment_max_installment_count: 3,
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
  persistIdentity = true,
  persistOrder = true,
  refundRequestRows = [{ id: "refund-1" }],
}: {
  correlationRows?: unknown[];
  orderRow?: unknown;
  orderRows?: unknown[];
  pendingReviewRows?: unknown[];
  persistIdentity?: boolean;
  persistOrder?: boolean;
  refundRequestRows?: unknown[];
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
    if (
      text.includes("update orders") &&
      text.includes("provider_customer_id = $2")
    ) {
      return Promise.resolve(
        queryResult(persistIdentity ? [{ id: ORDER_ID }] : [])
      );
    }
    if (text.includes("update orders")) {
      return Promise.resolve(
        queryResult(persistOrder ? [{ id: ORDER_ID }] : [])
      );
    }
    if (text.includes("update refund_requests")) {
      return Promise.resolve(queryResult(refundRequestRows));
    }
    if (
      text.includes("update webhook_events") ||
      text.includes("update payment_reviews") ||
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

const createStatefulIdentityReviewContext = () => {
  const order = createOrderRow({
    buyer_identity_status: "resolved",
    status: "pending",
    user_id: USER_ID,
  });
  const reviewEventIds = new Set<string>();
  const query = vi.fn((text: string, values?: unknown[]) => {
    if (text.includes("with correlation_identifiers")) {
      return Promise.resolve(
        queryResult([
          { id: ORDER_ID, match_kind: "payment_external_reference" },
        ])
      );
    }
    if (text.includes("from orders") && text.includes("where id = $1")) {
      return Promise.resolve(queryResult([order]));
    }
    if (text.includes("update webhook_events")) {
      return Promise.resolve(queryResult([{ id: EVENT_ID }]));
    }
    if (
      text.includes("from payment_reviews") &&
      text.includes("status = 'pending'")
    ) {
      return Promise.resolve(
        queryResult(
          reviewEventIds.size > 0 ? [{ id: "identity-review-1" }] : []
        )
      );
    }
    if (
      text.includes("update orders") &&
      text.includes("provider_checkout_id = coalesce")
    ) {
      if (values?.[4] === true && typeof values[5] === "string") {
        order.status = values[5];
      }
      return Promise.resolve(queryResult([{ id: ORDER_ID }]));
    }
    if (
      text.includes("update orders") &&
      text.includes("buyer_identity_status = 'review_required'")
    ) {
      const acceptsResolved = IDENTITY_REVIEW_RESOLVED_CAS_PATTERN.test(text);
      const acceptsPending =
        acceptsResolved || IDENTITY_REVIEW_PENDING_PATTERN.test(text);
      if (
        (order.buyer_identity_status === "pending" && acceptsPending) ||
        (order.buyer_identity_status === "resolved" && acceptsResolved)
      ) {
        order.buyer_identity_status = "review_required";
      }
      return Promise.resolve(queryResult([]));
    }
    if (text.includes("insert into payment_reviews")) {
      const eventId = values?.[1];
      if (typeof eventId === "string") {
        reviewEventIds.add(eventId);
      }
      return Promise.resolve(queryResult([]));
    }
    return Promise.reject(
      new Error(`Unexpected SQL in stateful identity review test: ${text}`)
    );
  });
  const context: AsaasWebhookProcessingContext = {
    client: { query } as unknown as PoolClient,
    lockOrder: vi.fn(async () => undefined),
  };
  return { context, order, query, reviewEventIds };
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

const createConfirmedRefundEvent = (
  paymentOverrides: Record<string, unknown> = {},
  id = EVENT_ID
) =>
  createPaymentEvent(
    "PAYMENT_REFUNDED",
    {
      refunds: [
        {
          dateCreated: "2026-07-30 12:00:00",
          status: "DONE",
          value: 129.9,
        },
      ],
      status: "REFUNDED",
      ...paymentOverrides,
    },
    id
  );

const processEvent = async (
  processor: ReturnType<typeof createAsaasWebhookProcessor>,
  event: ReturnType<typeof createPaymentEvent>,
  context: AsaasWebhookProcessingContext,
  preparation: Parameters<
    ReturnType<typeof createAsaasWebhookProcessor>["process"]
  >[2] = { kind: "not_required" }
) => await processor.process(event, context, preparation);

const resolvedPreparation = (overrides: Record<string, unknown> = {}) => ({
  customerId: "cus_1",
  identity: { email: "buyer@example.test", name: "Buyer" },
  kind: "resolved" as const,
  orderId: ORDER_ID,
  ...overrides,
});

describe("Asaas webhook processor", () => {
  it("grants once from a card installment after validating the aggregate total", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({ amount_in_cents: 30_000 }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });
    const event = createPaymentEvent("PAYMENT_CONFIRMED", {
      billingType: "CREDIT_CARD",
      installment: "ins_1",
      netValue: 95,
      status: "CONFIRMED",
      value: 100,
    });

    await processEvent(processor, event, context, {
      installment: {
        billingType: "CREDIT_CARD",
        checkoutSession: "chk_1",
        id: "ins_1",
        installmentCount: 3,
        netValueInCents: 28_500,
        paymentValueInCents: 10_000,
        refunds: [],
        valueInCents: 30_000,
      },
      kind: "not_required",
    });

    expect(applyPaidAccess).toHaveBeenCalledOnce();
  });

  it("reviews an installment above the order snapshot limit without granting access", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({
        amount_in_cents: 30_000,
        payment_max_installment_count: 2,
      }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(async () => ({
        activationRequired: false,
        userId: USER_ID,
      })),
    });
    const event = createPaymentEvent("PAYMENT_CONFIRMED", {
      billingType: "CREDIT_CARD",
      installment: "ins_1",
      netValue: 95,
      status: "CONFIRMED",
      value: 100,
    });

    await processEvent(processor, event, context, {
      installment: {
        billingType: "CREDIT_CARD",
        checkoutSession: "chk_1",
        id: "ins_1",
        installmentCount: 3,
        netValueInCents: 28_500,
        paymentValueInCents: 10_000,
        refunds: [],
        valueInCents: 30_000,
      },
      kind: "not_required",
    });

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "event_anomaly", "event_anomaly"]);
  });

  it("exposes separate preparation and transactional processing methods", async () => {
    const prepareIdentity = vi.fn(async () => ({
      kind: "not_required" as const,
    }));
    const gateway = { getCustomer: vi.fn() };
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      gateway: gateway as never,
      prepareIdentity,
      resolveIdentity: vi.fn(),
    });
    const event = createPaymentEvent("PAYMENT_RECEIVED");

    await expect(processor.prepare(event)).resolves.toEqual({
      kind: "not_required",
    });

    expect(prepareIdentity).toHaveBeenCalledWith(event, gateway);
    expect(processor.process).toEqual(expect.any(Function));
  });

  it("loads installment evidence during preparation before transactional processing", async () => {
    const installment = {
      billingType: "CREDIT_CARD",
      checkoutSession: "chk_1",
      id: "ins_1",
      installmentCount: 3,
      netValueInCents: 28_500,
      paymentValueInCents: 10_000,
      refunds: [],
      valueInCents: 30_000,
    };
    const getInstallment = vi.fn(async () => installment);
    const prepareIdentity = vi.fn(async () => ({
      kind: "not_required" as const,
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      getInstallment,
      prepareIdentity,
      resolveIdentity: vi.fn(),
    });
    const event = createPaymentEvent("PAYMENT_CONFIRMED", {
      billingType: "CREDIT_CARD",
      installment: "ins_1",
    });

    await expect(processor.prepare(event)).resolves.toEqual({
      installment,
      kind: "not_required",
    });

    expect(getInstallment).toHaveBeenCalledWith("ins_1");
  });

  it("persists resolved preparation once before resolving and granting a pending public order", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({
        buyer_identity_status: "pending",
        user_id: null,
      }),
    });
    const calls: string[] = [];
    const resolveIdentity = vi.fn(({ order }) => {
      calls.push("resolve");
      expect(order).toEqual({
        buyerIdentityStatus: "pending",
        courseId: COURSE_ID,
        customerEmail: "buyer@example.test",
        customerName: "Buyer",
        orderId: ORDER_ID,
        userId: null,
      });
      return Promise.resolve({
        activationRequired: true,
        userId: "public-user",
      });
    });
    const applyPaidAccess = vi.fn(() => {
      calls.push("grant");
      return Promise.resolve();
    });
    const enqueueMessage = vi.fn(async () => ({ id: null, inserted: false }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      resolvedPreparation()
    );

    const identityUpdate = queries.find(({ text }) =>
      text.includes("provider_customer_id = $2")
    );
    expect(identityUpdate?.text).toMatch(IDENTITY_PREPARATION_CAS_PATTERN);
    expect(identityUpdate?.values).toEqual([
      ORDER_ID,
      "cus_1",
      "Buyer",
      "buyer@example.test",
    ]);
    expect(calls).toEqual(["resolve", "grant"]);
    expect(enqueueMessage).toHaveBeenCalledOnce();
  });

  it("accepts an identical persisted preparation without overwriting it", async () => {
    const pendingPublic = createOrderRow({
      buyer_identity_status: "pending",
      customer_email: "buyer@example.test",
      customer_name: "Buyer",
      provider_customer_id: "cus_1",
      user_id: null,
    });
    const { context, queries } = createContext({
      orderRows: [pendingPublic, pendingPublic],
      persistIdentity: false,
    });
    const resolveIdentity = vi.fn(async () => ({
      activationRequired: true,
      userId: "public-user",
    }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity,
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      resolvedPreparation()
    );

    expect(resolveIdentity).toHaveBeenCalledOnce();
    expect(
      queries.filter(({ text }) => text.includes("provider_customer_id = $2"))
    ).toHaveLength(1);
  });

  it.each([
    ["customer id", { provider_customer_id: "cus_other" }],
    ["email", { customer_email: "other@example.test" }],
    ["name", { customer_name: "Other" }],
  ])("reviews a divergent persisted preparation by %s", async (_label, mismatch) => {
    const staleOrder = createOrderRow({
      buyer_identity_status: "pending",
      customer_email: "buyer@example.test",
      customer_name: "Buyer",
      provider_customer_id: "cus_1",
      user_id: null,
      ...mismatch,
    });
    const { context, queries } = createContext({
      orderRows: [staleOrder, staleOrder],
      persistIdentity: false,
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({ id: null, inserted: false }));
    const resolveIdentity = vi.fn();
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      resolvedPreparation()
    );

    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([
      ORDER_ID,
      EVENT_ID,
      "buyer_identity",
      "buyer_identity_conflict",
    ]);
  });

  it.each([
    [
      "preparation for another order",
      resolvedPreparation({ orderId: "other" }),
      "buyer_identity_conflict",
    ],
    [
      "review-required preparation",
      {
        customerId: null,
        kind: "review_required" as const,
        orderId: ORDER_ID,
        reason: "buyer_identity_missing" as const,
      },
      "buyer_identity_missing",
    ],
    [
      "missing grant preparation",
      { kind: "not_required" as const },
      "buyer_identity_missing",
    ],
  ])("fails closed for %s", async (_label, preparation, reason) => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({
        buyer_identity_status: "pending",
        user_id: null,
      }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({ id: null, inserted: false }));
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity: vi.fn(),
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      preparation
    );

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "buyer_identity", reason]);
    expect(
      queries.some(
        ({ text }) =>
          text.includes("buyer_identity_status = 'review_required'") &&
          text.includes("buyer_identity_status in ('pending', 'resolved')")
      )
    ).toBe(true);
  });

  it("never grants an order already in identity review", async () => {
    const { context } = createContext({
      orderRow: createOrderRow({
        buyer_identity_status: "review_required",
        user_id: null,
      }),
    });
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({ id: null, inserted: false }));
    const resolveIdentity = vi.fn();
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      resolvedPreparation()
    );

    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
  });

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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED", { value: 100 }),
      context
    );
    await processEvent(
      processor,
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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED", {
        billingType: "CREDIT_CARD",
        status: "RECEIVED",
      }),
      context
    );
    await processEvent(
      processor,
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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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
      processEvent(
        processor,
        createPaymentEvent("PAYMENT_FUTURE_EVENT"),
        context
      )
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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context
    );

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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context
    );

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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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
        buyer_identity_status: "pending",
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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context,
      resolvedPreparation()
    );

    expect(resolveIdentity).toHaveBeenCalledWith({
      client: context.client,
      order: {
        buyerIdentityStatus: "pending",
        courseId: COURSE_ID,
        customerEmail: "buyer@example.test",
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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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
    ["buyer_identity_course_revoked", "buyer_identity_course_revoked"],
    ["buyer_identity_platform_blocked", "buyer_identity_platform_blocked"],
    ["buyer_identity_team_account", "buyer_identity_team_account"],
    ["order_identity_conflict", "buyer_identity_conflict"],
    ["order_identity_incomplete", "buyer_identity_invalid"],
    ["order_user_not_found", "buyer_identity_invalid"],
  ] satisfies [
    LocalOrderIdentityErrorCode,
    string,
  ][])("persists paid evidence and reviews deterministic identity error %s", async (identityErrorCode, expectedReason) => {
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
      processEvent(processor, createPaymentEvent("PAYMENT_RECEIVED"), context)
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
    ).toEqual([ORDER_ID, EVENT_ID, "buyer_identity", expectedReason]);
  });

  it.each([
    "buyer_identity_team_account",
    "buyer_identity_platform_blocked",
    "buyer_identity_course_revoked",
  ] satisfies LocalOrderIdentityErrorCode[])("moves a resolved paid identity to review for %s and keeps retry effect-free", async (identityErrorCode) => {
    const { context, order, query, reviewEventIds } =
      createStatefulIdentityReviewContext();
    const applyPaidAccess = vi.fn(async () => undefined);
    const enqueueMessage = vi.fn(async () => ({
      id: null,
      inserted: false,
    }));
    const resolveIdentity = vi.fn(() =>
      Promise.reject(new LocalOrderIdentityError(identityErrorCode))
    );
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess,
      applyRevocation: vi.fn(async () => true),
      enqueueMessage,
      resolveIdentity,
    });
    const event = createPaymentEvent("PAYMENT_RECEIVED");

    await processEvent(processor, event, context);
    await processEvent(processor, event, context);

    expect(order).toMatchObject({
      buyer_identity_status: "review_required",
      status: "paid",
      user_id: USER_ID,
    });
    expect(resolveIdentity).toHaveBeenCalledOnce();
    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(enqueueMessage).not.toHaveBeenCalled();
    expect(reviewEventIds).toEqual(new Set([EVENT_ID]));
    const reviewInserts = query.mock.calls.filter(([text]) =>
      String(text).includes("insert into payment_reviews")
    );
    expect(reviewInserts.length).toBeGreaterThan(0);
    expect(
      reviewInserts.every(([text]) =>
        String(text).includes("on conflict (webhook_event_id)")
      )
    ).toBe(true);
  });

  it.each([
    ["PAYMENT_REFUNDED", "payment_refund", "refunded"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "payment_dispute", "disputed"],
  ])("revokes access for %s and preserves the domain reason", async (eventName, expectedReason, expectedStatus) => {
    const { context } = createContext({
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

    await processEvent(
      processor,
      createPaymentEvent(eventName, { status: expectedStatus.toUpperCase() }),
      context
    );

    expect(applyRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expectedReason, userId: USER_ID })
    );
  });

  it("closes only the pending buyer identity review when an exact full refund request is confirmed", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => NOW,
      resolveIdentity: vi.fn(),
    });

    await processEvent(processor, createConfirmedRefundEvent(), context);

    const refundUpdateIndex = queries.findIndex(({ text }) =>
      text.includes("update refund_requests")
    );
    const reviewUpdateIndex = queries.findIndex(({ text }) =>
      text.includes("update payment_reviews")
    );
    expect(refundUpdateIndex).toBeGreaterThan(-1);
    expect(reviewUpdateIndex).toBeGreaterThan(refundUpdateIndex);
    const reviewUpdate = queries[reviewUpdateIndex];
    expect(reviewUpdate?.values).toEqual([ORDER_ID, NOW]);
    expect(reviewUpdate?.text).toContain("status='rejected'");
    expect(reviewUpdate?.text).toContain(
      "decision_reason='buyer_identity_refunded'"
    );
    expect(reviewUpdate?.text).toContain("resolved_by_user_id=null");
    expect(reviewUpdate?.text).toContain(
      "resolved_at=coalesce(resolved_at,$2)"
    );
    expect(reviewUpdate?.text).toContain("where order_id=$1");
    expect(reviewUpdate?.text).toContain("type='buyer_identity'");
    expect(reviewUpdate?.text).toContain("status='pending'");
  });

  it.each([
    [
      "partial refund",
      createPaymentEvent("PAYMENT_PARTIALLY_REFUNDED", {
        refunds: [
          {
            dateCreated: "2026-07-30 12:00:00",
            status: "DONE",
            value: 100,
          },
        ],
        status: "PARTIALLY_REFUNDED",
      }),
    ],
    [
      "refund still in progress",
      createPaymentEvent("PAYMENT_REFUND_IN_PROGRESS", {
        refunds: [
          {
            dateCreated: "2026-07-30 12:00:00",
            status: "DONE",
            value: 129.9,
          },
        ],
        status: "REFUND_IN_PROGRESS",
      }),
    ],
    [
      "missing exact financial evidence",
      createPaymentEvent("PAYMENT_REFUNDED", { status: "REFUNDED" }),
    ],
    [
      "divergent refund value",
      createConfirmedRefundEvent({
        refunds: [
          {
            dateCreated: "2026-07-30 12:00:00",
            status: "DONE",
            value: 100,
          },
        ],
      }),
    ],
    [
      "unconfirmed refund evidence",
      createConfirmedRefundEvent({
        refunds: [
          {
            dateCreated: "2026-07-30 12:00:00",
            status: "CREATED",
            value: 129.9,
          },
        ],
      }),
    ],
  ])("does not close buyer identity review for %s", async (_case, event) => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => NOW,
      resolveIdentity: vi.fn(),
    });

    await processEvent(processor, event, context);

    expect(
      queries.some(({ text }) => text.includes("update payment_reviews"))
    ).toBe(false);
  });

  it("does not close a buyer identity review when the local refund request is only requested", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
      refundRequestRows: [],
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => NOW,
      resolveIdentity: vi.fn(),
    });

    await processEvent(processor, createConfirmedRefundEvent(), context);

    const refundUpdate = queries.find(({ text }) =>
      text.includes("update refund_requests")
    );
    expect(refundUpdate?.text).toContain(
      "status in ('processing', 'uncertain', 'confirmed')"
    );
    expect(
      queries.some(({ text }) => text.includes("update payment_reviews"))
    ).toBe(false);
  });

  it("keeps buyer identity review resolution idempotent on a confirmed retry", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "refunded" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => false),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => NOW,
      resolveIdentity: vi.fn(),
    });
    const event = createConfirmedRefundEvent();

    await processEvent(processor, event, context);
    await processEvent(processor, event, context);

    const reviewUpdates = queries.filter(({ text }) =>
      text.includes("update payment_reviews")
    );
    expect(reviewUpdates).toHaveLength(2);
    expect(
      reviewUpdates.every(({ text }) =>
        text.includes("resolved_at=coalesce(resolved_at,$2)")
      )
    ).toBe(true);
    expect(reviewUpdates.every(({ values }) => values?.[1] === NOW)).toBe(true);
  });

  it("does not close any review when refund identifiers diverge", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({ status: "paid" }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      now: () => NOW,
      resolveIdentity: vi.fn(),
    });

    await processEvent(
      processor,
      createConfirmedRefundEvent({ externalReference: "order_other" }),
      context
    );

    expect(
      queries.some(({ text }) => text.includes("update refund_requests"))
    ).toBe(false);
    expect(
      queries.some(({ text }) => text.includes("update payment_reviews"))
    ).toBe(false);
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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

    await processEvent(processor, createConfirmedRefundEvent(), context);

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

    await processEvent(
      processor,
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

  it("confirms an installment refund from per-charge evidence", async () => {
    const { context, queries } = createContext({
      orderRow: createOrderRow({
        provider_installment_id: "ins_1",
        status: "paid",
      }),
    });
    const processor = createAsaasWebhookProcessor({
      applyPaidAccess: vi.fn(async () => undefined),
      applyRevocation: vi.fn(async () => true),
      enqueueMessage: vi.fn(async () => ({ id: null, inserted: false })),
      resolveIdentity: vi.fn(),
    });

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_REFUNDED", {
        billingType: "CREDIT_CARD",
        installment: "ins_1",
        status: "REFUNDED",
        value: 43.3,
      }),
      context,
      {
        installment: {
          billingType: "CREDIT_CARD",
          checkoutSession: "chk_1",
          id: "ins_1",
          installmentCount: 3,
          netValueInCents: 12_500,
          paymentValueInCents: 4330,
          refunds: [
            {
              dateCreated: "2026-08-02 01:45:03",
              status: "DONE",
              valueInCents: 4330,
            },
            {
              dateCreated: "2026-08-02 01:45:03",
              status: "DONE",
              valueInCents: 4330,
            },
            {
              dateCreated: "2026-08-02 01:45:03",
              status: "DONE",
              valueInCents: 4330,
            },
          ],
          valueInCents: 12_990,
        },
        kind: "not_required",
      }
    );

    const refundUpdate = queries.find(({ text }) =>
      text.includes("update refund_requests")
    );
    expect(refundUpdate?.values).toEqual([
      ORDER_ID,
      expect.any(Date),
      "DONE",
      "2026-08-02 01:45:03",
      null,
      null,
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
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

    await processEvent(
      processor,
      createPaymentEvent("PAYMENT_RECEIVED"),
      context
    );

    expect(applyPaidAccess).not.toHaveBeenCalled();
    expect(
      queries.find(({ text }) => text.includes("insert into payment_reviews"))
        ?.values
    ).toEqual([ORDER_ID, EVENT_ID, "terminal_conflict", "terminal_conflict"]);
  });
});
