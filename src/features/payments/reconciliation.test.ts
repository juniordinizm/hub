import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaymentRevocation: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/enrollments/server", () => ({
  applyPaymentRevocation: dependencies.applyPaymentRevocation,
}));
vi.mock("@/features/payments/provider", () => ({
  getAsaasProviderClient: vi.fn(),
}));

import { FakeAsaasGateway } from "./fake-asaas-gateway";
import {
  importAsaasFinancialStatement,
  reconcileAsaasPayment,
} from "./reconciliation";

const orderRow = {
  amount_in_cents: 12_990,
  buyer_identity_status: "resolved",
  course_id: "course-1",
  external_id: "order_order-1",
  id: "order-1",
  provider_checkout_id: "chk-1",
  provider_installment_id: null,
  provider_payment_id: "pay-1",
  provider_payment_status: "RECEIVED",
  status: "paid",
  user_id: "user-1",
};

const payment = {
  billingType: "PIX",
  checkoutSession: "chk-1",
  customer: "cus-1",
  externalReference: "order_order-1",
  id: "pay-1",
  netValueInCents: 12_500,
  refunds: [
    {
      dateCreated: "2026-07-29 10:19:06",
      status: "DONE",
      valueInCents: 12_990,
    },
  ],
  status: "REFUNDED",
  valueInCents: 12_990,
};

describe("Asaas reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.applyPaymentRevocation.mockResolvedValue(true);
  });

  it("reconciles only the selected payment and confirms exact refund evidence", async () => {
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders") ? { rows: [orderRow] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });
    const gateway = new FakeAsaasGateway({ getPayment: payment });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway,
      orderId: "order-1",
    });

    expect(gateway.calls.getPayment).toEqual(["pay-1"]);
    expect(dependencies.applyPaymentRevocation).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: "course-1",
        orderId: "order-1",
        reason: "payment_refund",
        userId: "user-1",
      })
    );
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("update refund_requests")
      )?.values
    ).toEqual([
      "order-1",
      "DONE",
      "2026-07-29 10:19:06",
      null,
      null,
      12_990,
      expect.any(Date),
    ]);
  });

  it("reconciles a Checkout payment without externalReference when its session is exact", async () => {
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve(
          text.includes("from orders") ? { rows: [orderRow] } : { rows: [] }
        )
      ),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway: new FakeAsaasGateway({
          getPayment: { ...payment, externalReference: null },
        }),
        orderId: "order-1",
      })
    ).resolves.toBeUndefined();
  });

  it("reconciles every payment under the exact installment aggregate", async () => {
    const installmentOrder = {
      ...orderRow,
      buyer_identity_status: "review_required",
      provider_installment_id: "ins-1",
      provider_payment_status: "CONFIRMED",
      user_id: null,
    };
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders")
            ? { rows: [installmentOrder] }
            : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [installmentOrder] }),
    });
    const installmentPayment = {
      ...payment,
      billingType: "CREDIT_CARD",
      checkoutSession: "chk-1",
      externalReference: null,
      installmentId: "ins-1",
      netValueInCents: 4200,
      refunds: [],
      status: "REFUNDED",
      valueInCents: 4330,
    };
    const installmentRefunds = [
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
    ];
    const gateway = new FakeAsaasGateway({
      getInstallment: {
        billingType: "CREDIT_CARD",
        checkoutSession: "chk-1",
        id: "ins-1",
        installmentCount: 3,
        netValueInCents: 12_500,
        paymentValueInCents: 4330,
        refunds: installmentRefunds,
        valueInCents: 12_990,
      },
      listInstallmentPayments: {
        data: [
          installmentPayment,
          { ...installmentPayment, id: "pay-2" },
          { ...installmentPayment, id: "pay-3" },
        ],
        hasMore: false,
        limit: 100,
        object: "list",
        offset: 0,
        totalCount: 3,
      },
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway,
        orderId: "order-1",
      })
    ).resolves.toBeUndefined();

    expect(gateway.calls.getInstallment).toEqual(["ins-1"]);
    expect(gateway.calls.listInstallmentPayments).toEqual(["ins-1"]);
    expect(gateway.calls.getPayment).toEqual([]);
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("update refund_requests")
      )?.values
    ).toEqual([
      "order-1",
      "DONE",
      "2026-08-02 01:45:03",
      null,
      null,
      12_990,
      expect.any(Date),
    ]);
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("update payment_reviews")
      )?.values
    ).toEqual(["order-1", expect.any(Date)]);
    expect(
      transactionQueries.some(({ text }) =>
        text.includes("insert into payment_reviews")
      )
    ).toBe(false);
  });

  it.each([
    {
      checkoutSession: "chk-other",
      externalReference: null,
    },
    {
      checkoutSession: "chk-1",
      externalReference: "order_other",
    },
  ])("rejects payment correlation when a provider identifier conflicts", async ({
    checkoutSession,
    externalReference,
  }) => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway: new FakeAsaasGateway({
          getPayment: { ...payment, checkoutSession, externalReference },
        }),
        orderId: "order-1",
      })
    ).rejects.toThrow("A consulta Asaas nao corresponde ao Pedido informado.");
  });

  it("imports the documented statement page idempotently by provider id", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "local-1" }] });
    dependencies.getPool.mockReturnValue({ query });
    const gateway = new FakeAsaasGateway({
      listFinancialTransactions: {
        data: [
          {
            date: "2026-07-28",
            id: "ft-1",
            type: "PAYMENT_FEE",
            valueInCents: -299,
          },
        ],
        hasMore: false,
        limit: 100,
        object: "list",
        offset: 0,
        totalCount: 1,
      },
    });

    await expect(
      importAsaasFinancialStatement({
        actorUserId: "admin-1",
        finishDate: "2026-07-28",
        gateway,
        startDate: "2026-07-28",
      })
    ).resolves.toEqual({ imported: 1 });

    expect(gateway.calls.listFinancialTransactions).toEqual([
      {
        finishDate: "2026-07-28",
        limit: 100,
        offset: 0,
        order: "asc",
        startDate: "2026-07-28",
      },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (provider_transaction_id)"),
      ["ft-1", "2026-07-28", "PAYMENT_FEE", -299]
    );
  });

  it("preserves a conflicting terminal state, opens review and still revokes exact refunded access", async () => {
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const conflictedOrder = { ...orderRow, status: "disputed" };
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders")
            ? { rows: [conflictedOrder] }
            : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [conflictedOrder] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: payment }),
      orderId: "order-1",
    });

    expect(dependencies.applyPaymentRevocation).toHaveBeenCalledOnce();
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual([
      "order-1",
      "terminal_conflict",
      expect.stringContaining("disputed"),
    ]);
    expect(
      transactionQueries.find(({ text }) => text.includes("set status = case"))
        ?.values
    ).toEqual(["order-1", "DONE", false, expect.any(Date)]);
  });

  it("opens amount review and does not revoke when provider gross differs from the Order snapshot", async () => {
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const mismatchedPayment = {
      ...payment,
      netValueInCents: 12_510,
      refunds: [
        {
          dateCreated: "2026-07-29 10:19:06",
          status: "DONE",
          valueInCents: 13_000,
        },
      ],
      valueInCents: 13_000,
    };
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders") ? { rows: [orderRow] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: mismatchedPayment }),
      orderId: "order-1",
    });

    expect(dependencies.applyPaymentRevocation).not.toHaveBeenCalled();
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual(["order-1", "amount_mismatch", expect.stringContaining("13000")]);
    expect(
      transactionQueries.some(({ text }) =>
        text.includes("update refund_requests")
      )
    ).toBe(false);
    expect(
      transactionQueries
        .find(({ text }) => text.includes("paid_amount_in_cents"))
        ?.values?.at(-1)
    ).toBe(false);
  });

  it("does not persist an impossible net amount and opens anomaly review", async () => {
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const impossiblePayment = {
      ...payment,
      netValueInCents: 13_500,
    };
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders") ? { rows: [orderRow] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: impossiblePayment }),
      orderId: "order-1",
    });

    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual(["order-1", "event_anomaly", expect.stringContaining("liquido")]);
    expect(
      transactionQueries
        .find(({ text }) => text.includes("paid_amount_in_cents"))
        ?.values?.at(-1)
    ).toBe(false);
  });

  it("preserves settled provider and monetary evidence on a regressive status", async () => {
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const regressivePayment = {
      ...payment,
      netValueInCents: 0,
      refunds: [],
      status: "PENDING",
    };
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        return Promise.resolve(
          text.includes("from orders") ? { rows: [orderRow] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [orderRow] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: regressivePayment }),
      orderId: "order-1",
    });

    const evidenceUpdate = transactionQueries.find(({ text }) =>
      text.includes("paid_amount_in_cents")
    );
    expect(evidenceUpdate?.values?.at(-2)).toBe(false);
    expect(evidenceUpdate?.values?.at(-1)).toBe(false);
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual([
      "order-1",
      "event_anomaly",
      expect.stringContaining("regressivo"),
    ]);
  });
});
