import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  gateway: {
    refundInstallment: vi.fn(),
    refundPayment: vi.fn(),
  },
  getAsaasProviderClient: vi.fn(),
  getPool: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@better-auth/utils/password", () => ({
  verifyPassword: dependencies.verifyPassword,
}));
vi.mock("@/features/payments/provider", () => ({
  getAsaasProviderClient: dependencies.getAsaasProviderClient,
}));

import { AsaasGatewayError } from "./asaas-client";
import { issueRefundConfirmation, requestFullRefund } from "./refunds";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const REFUND_ID = "00000000-0000-4000-8000-000000000002";
const ACTOR_ID = "admin-1";

interface QueryRecord {
  text: string;
  values?: unknown[];
}

const createRefundDatabase = ({
  confirmedBeforePostMutation = false,
  providerInstallmentId = null,
  reservationExists = true,
}: {
  confirmedBeforePostMutation?: boolean;
  providerInstallmentId?: string | null;
  reservationExists?: boolean;
} = {}) => {
  const queries: QueryRecord[] = [];
  const query = vi.fn((text: string, values?: unknown[]) => {
    queries.push(values ? { text, values } : { text });
    if (text.includes("delete from verifications")) {
      return Promise.resolve({ rows: [{ id: "confirmation-id" }] });
    }
    if (text.includes("from orders")) {
      return Promise.resolve({
        rows: [
          {
            amount_in_cents: 12_990,
            external_id: `order_${ORDER_ID}`,
            provider_checkout_id: "chk_123",
            provider_installment_id: providerInstallmentId,
            provider_payment_id: "pay_123",
            status: "paid",
          },
        ],
      });
    }
    if (text.includes("insert into refund_requests")) {
      return Promise.resolve({
        rows: reservationExists ? [{ id: REFUND_ID }] : [],
      });
    }
    if (text.includes("update refund_requests")) {
      if (
        confirmedBeforePostMutation &&
        text.includes("status = 'processing'")
      ) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [{ id: REFUND_ID }] });
    }
    if (text.includes("select status from refund_requests")) {
      return Promise.resolve({ rows: [{ status: "confirmed" }] });
    }
    return Promise.resolve({ rows: [] });
  });
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  dependencies.getPool.mockReturnValue({ connect, query });
  return { connect, queries, query, release };
};

const validRefundPayment = {
  billingType: "PIX",
  checkoutSession: "chk_123",
  customer: "cus_123",
  externalReference: `order_${ORDER_ID}`,
  id: "pay_123",
  netValueInCents: 0,
  refunds: [
    {
      dateCreated: "2026-07-29 10:19:06",
      endToEndIdentifier: "E123",
      status: "DONE",
      transactionReceiptUrl: "https://asaas.example/refund-receipt",
      valueInCents: 12_990,
    },
  ],
  status: "REFUNDED",
  valueInCents: 12_990,
} as const;

const requestRefund = (): Promise<void> =>
  requestFullRefund({
    actorUserId: ACTOR_ID,
    confirmationToken: "confirmation-token",
    orderId: ORDER_ID,
    reason: "Solicitação aprovada pelo suporte",
    typedOrderId: ORDER_ID,
  });

describe("refund audit transactions", () => {
  it("creates the confirmation token and audit record in one transaction", async () => {
    const release = vi.fn();
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const accountQuery = vi.fn().mockResolvedValue({
      rows: [{ password: "password-hash" }],
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
      query: accountQuery,
    });
    dependencies.verifyPassword.mockResolvedValue(true);

    await expect(
      issueRefundConfirmation({
        actorUserId: "admin-1",
        orderId: "order-1",
        password: "correct-password",
      })
    ).resolves.toEqual({ confirmationToken: expect.any(String) });

    expect(clientQuery).toHaveBeenNthCalledWith(1, "begin");
    expect(clientQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "refund.password_confirmed", "order-1"]
    );
    expect(clientQuery).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });
});

describe("Asaas full refund requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getAsaasProviderClient.mockReturnValue(dependencies.gateway);
  });

  it("reserves once, performs one full mutation and persists exact evidence as processing", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue(validRefundPayment);

    await expect(requestRefund()).resolves.toBeUndefined();

    expect(dependencies.gateway.refundPayment).toHaveBeenCalledOnce();
    expect(dependencies.gateway.refundPayment).toHaveBeenCalledWith({
      description: "Solicitação aprovada pelo suporte",
      paymentId: "pay_123",
    });
    const reservation = queries.find(({ text }) =>
      text.includes("insert into refund_requests")
    );
    expect(reservation?.text).toContain("'processing'");
    expect(reservation?.text).toContain(
      "where refund_requests.status = 'failed'"
    );
    const evidence = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("2026-07-29 10:19:06")
    );
    expect(evidence?.text).toContain("provider_refund_created_at");
    expect(evidence?.text).toContain("status = 'processing'");
    expect(evidence?.values).toEqual([
      REFUND_ID,
      "DONE",
      "2026-07-29 10:19:06",
      "E123",
      "https://asaas.example/refund-receipt",
      12_990,
    ]);
    expect(
      queries.find(({ text }) => text.includes("from orders"))?.text
    ).toContain("provider_checkout_id");
  });

  it("refunds a card installment through the aggregate endpoint", async () => {
    createRefundDatabase({ providerInstallmentId: "ins_123" });
    dependencies.gateway.refundInstallment.mockResolvedValue({
      billingType: "CREDIT_CARD",
      checkoutSession: "chk_123",
      id: "ins_123",
      installmentCount: 3,
      netValueInCents: 12_000,
      paymentValueInCents: 4330,
      refunds: validRefundPayment.refunds,
      valueInCents: 12_990,
    });

    await expect(requestRefund()).resolves.toBeUndefined();

    expect(dependencies.gateway.refundInstallment).toHaveBeenCalledWith({
      installmentId: "ins_123",
    });
    expect(dependencies.gateway.refundPayment).not.toHaveBeenCalled();
  });

  it("aggregates the per-charge refund evidence returned for an installment", async () => {
    const { queries } = createRefundDatabase({
      providerInstallmentId: "ins_123",
    });
    dependencies.gateway.refundInstallment.mockResolvedValue({
      billingType: "CREDIT_CARD",
      checkoutSession: "chk_123",
      id: "ins_123",
      installmentCount: 3,
      netValueInCents: 12_000,
      paymentValueInCents: 4330,
      refunds: [
        {
          dateCreated: "2026-08-02 01:45:03",
          status: "DONE",
          transactionReceiptUrl: "https://asaas.example/refund-1",
          valueInCents: 4330,
        },
        {
          dateCreated: "2026-08-02 01:45:03",
          status: "DONE",
          transactionReceiptUrl: "https://asaas.example/refund-2",
          valueInCents: 4330,
        },
        {
          dateCreated: "2026-08-02 01:45:03",
          status: "DONE",
          transactionReceiptUrl: "https://asaas.example/refund-3",
          valueInCents: 4330,
        },
      ],
      valueInCents: 12_990,
    });

    await expect(requestRefund()).resolves.toBeUndefined();

    const evidence = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("2026-08-02 01:45:03")
    );
    expect(evidence?.values).toEqual([
      REFUND_ID,
      "DONE",
      "2026-08-02 01:45:03",
      null,
      null,
      12_990,
    ]);
  });

  it("accepts a null external reference when the checkout session matches exactly", async () => {
    createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue({
      ...validRefundPayment,
      externalReference: null,
    });

    await expect(requestRefund()).resolves.toBeUndefined();
  });

  it("marks a null external reference with a conflicting checkout session uncertain", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue({
      ...validRefundPayment,
      checkoutSession: "chk_other",
      externalReference: null,
    });

    await expect(requestRefund()).rejects.toThrow(
      "Resultado do reembolso pendente de conciliacao."
    );
    const uncertain = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("asaas_refund_invalid_result")
    );
    expect(uncertain?.text).toContain("status = 'uncertain'");
  });

  it("does not mutate Asaas when an active reservation already exists", async () => {
    createRefundDatabase({ reservationExists: false });

    await expect(requestRefund()).rejects.toThrow(
      "Ja existe uma solicitacao de estorno para este pedido."
    );

    expect(dependencies.gateway.refundPayment).not.toHaveBeenCalled();
  });

  it("marks a definitive provider rejection failed using only a safe code", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockRejectedValue(
      new AsaasGatewayError({
        kind: "validation",
        message: "private provider message",
        outcome: "rejected",
        providerCode: "refund_not_allowed",
        retryable: false,
      })
    );

    await expect(requestRefund()).rejects.toThrow(
      "Solicitacao de reembolso rejeitada pelo Asaas."
    );
    const failure = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("refund_not_allowed")
    );
    expect(failure?.text).toContain("status = 'failed'");
    expect(JSON.stringify(queries)).not.toContain("private provider message");
  });

  it.each([
    ["timeout", "timeout"],
    ["5xx", "provider_unavailable"],
    ["transport", "transport"],
  ] as const)("marks an unknown %s outcome uncertain without retrying", async (_label, kind) => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockRejectedValue(
      new AsaasGatewayError({
        kind,
        message: "secret@example.com token=private",
        outcome: "unknown",
        retryable: false,
      })
    );

    await expect(requestRefund()).rejects.toThrow(
      "Resultado do reembolso pendente de conciliacao."
    );
    expect(dependencies.gateway.refundPayment).toHaveBeenCalledOnce();
    const uncertain = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes(`asaas_refund_${kind}`)
    );
    expect(uncertain?.text).toContain("status = 'uncertain'");
    expect(JSON.stringify(queries)).not.toContain("secret@example.com");
  });

  it("marks a semantically invalid success uncertain instead of retrying", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue({
      ...validRefundPayment,
      refunds: [
        {
          ...validRefundPayment.refunds[0],
          valueInCents: 1000,
        },
      ],
    });

    await expect(requestRefund()).rejects.toThrow(
      "Resultado do reembolso pendente de conciliacao."
    );
    expect(dependencies.gateway.refundPayment).toHaveBeenCalledOnce();
    const uncertain = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("asaas_refund_invalid_result")
    );
    expect(uncertain?.text).toContain("status = 'uncertain'");
  });

  it("marks a response for another payment uncertain even when the amount matches", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue({
      ...validRefundPayment,
      id: "pay_other",
    });

    await expect(requestRefund()).rejects.toThrow(
      "Resultado do reembolso pendente de conciliacao."
    );
    const uncertain = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("asaas_refund_invalid_result")
    );
    expect(uncertain?.text).toContain("status = 'uncertain'");
  });

  it("rejects a conflicting external reference even when checkout session matches", async () => {
    const { queries } = createRefundDatabase();
    dependencies.gateway.refundPayment.mockResolvedValue({
      ...validRefundPayment,
      externalReference: "order_other",
    });

    await expect(requestRefund()).rejects.toThrow(
      "Resultado do reembolso pendente de conciliacao."
    );
    const uncertain = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("asaas_refund_invalid_result")
    );
    expect(uncertain?.text).toContain("status = 'uncertain'");
  });

  it("preserves webhook confirmation that wins the race with a successful response", async () => {
    const { queries } = createRefundDatabase({
      confirmedBeforePostMutation: true,
    });
    dependencies.gateway.refundPayment.mockResolvedValue(validRefundPayment);

    await expect(requestRefund()).resolves.toBeUndefined();

    const evidenceUpdate = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("2026-07-29 10:19:06")
    );
    expect(evidenceUpdate?.text).toContain("status = 'processing'");
    expect(evidenceUpdate?.text).toContain(
      "where id = $1 and status = 'processing'"
    );
    expect(
      queries.some(({ text }) =>
        text.includes("select status from refund_requests")
      )
    ).toBe(true);
  });

  it("preserves webhook confirmation that wins the race with a timeout", async () => {
    const { queries } = createRefundDatabase({
      confirmedBeforePostMutation: true,
    });
    dependencies.gateway.refundPayment.mockRejectedValue(
      new AsaasGatewayError({
        kind: "timeout",
        message: "timeout",
        outcome: "unknown",
        retryable: false,
      })
    );

    await expect(requestRefund()).resolves.toBeUndefined();

    const failureUpdate = queries.find(
      ({ text, values }) =>
        text.includes("update refund_requests") &&
        values?.includes("asaas_refund_timeout")
    );
    expect(failureUpdate?.text).toContain(
      "where id = $1 and status = 'processing'"
    );
    expect(
      queries.some(
        ({ text, values }) =>
          text.includes("insert into audit_logs") &&
          values?.includes("refund.uncertain")
      )
    ).toBe(false);
  });
});
