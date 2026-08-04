import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaidWebhookAccess: vi.fn(),
  applyPaymentRevocation: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  getPool: vi.fn(),
  LocalOrderIdentityError: class LocalOrderIdentityError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  resolveLocalOrderIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/enrollments/server", () => ({
  applyPaidWebhookAccess: dependencies.applyPaidWebhookAccess,
  applyPaymentRevocation: dependencies.applyPaymentRevocation,
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
vi.mock("@/features/payments/order-identity", () => ({
  LocalOrderIdentityError: dependencies.LocalOrderIdentityError,
  resolveLocalOrderIdentity: dependencies.resolveLocalOrderIdentity,
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
  access_duration_months: 12,
  amount_in_cents: 12_990,
  buyer_identity_status: "resolved",
  course_id: "course-1",
  external_id: "order_order-1",
  id: "order-1",
  provider_checkout_id: "chk-1",
  provider_customer_id: "cus-1",
  provider_installment_id: null,
  provider_payment_id: "pay-1",
  provider_payment_status: "RECEIVED",
  provider_purchase_flow: "checkout",
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
    dependencies.resolveLocalOrderIdentity.mockResolvedValue({
      activationRequired: false,
      userId: "user-1",
    });
  });

  it("grants access when reconciliation recovers a confirmed pending payment", async () => {
    const pendingOrder = {
      ...orderRow,
      provider_payment_status: null,
      status: "pending",
    };
    const confirmedPayment = {
      ...payment,
      refunds: [],
      status: "RECEIVED",
    };
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        if (text.includes("set status = 'paid'")) {
          return Promise.resolve({ rows: [{ id: "order-1" }] });
        }
        return Promise.resolve(
          text.includes("from orders") ? { rows: [pendingOrder] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [pendingOrder] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: confirmedPayment }),
      orderId: "order-1",
    });

    expect(dependencies.applyPaidWebhookAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        accessDurationMonths: 12,
        client,
        courseId: "course-1",
        orderId: "order-1",
        userId: "user-1",
      })
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledOnce();
    expect(
      transactionQueries.some(({ text }) =>
        text.includes("set status = 'paid'")
      )
    ).toBe(true);
  });

  it("does not grant a PIX payment that is only confirmed", async () => {
    const pendingOrder = {
      ...orderRow,
      provider_payment_status: null,
      status: "pending",
    };
    const pixOnlyConfirmed = {
      ...payment,
      refunds: [],
      status: "CONFIRMED",
    };
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve(
          text.includes("from orders") ? { rows: [pendingOrder] } : { rows: [] }
        )
      ),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [pendingOrder] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: pixOnlyConfirmed }),
      orderId: "order-1",
    });

    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
    expect(
      client.query.mock.calls.some(([text]) =>
        String(text).includes("set status = 'paid'")
      )
    ).toBe(false);
  });

  it("does not grant a reconciled card payment after risk reproval", async () => {
    const pendingOrder = {
      ...orderRow,
      provider_payment_status: null,
      provider_risk_status: "REPROVED_BY_RISK_ANALYSIS",
      status: "pending",
    };
    const cardConfirmed = {
      ...payment,
      billingType: "CREDIT_CARD",
      refunds: [],
      status: "CONFIRMED",
    };
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve(
          text.includes("from orders") ? { rows: [pendingOrder] } : { rows: [] }
        )
      ),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [pendingOrder] }),
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway: new FakeAsaasGateway({ getPayment: cardConfirmed }),
      orderId: "order-1",
    });

    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(
      client.query.mock.calls.some(([text]) =>
        String(text).includes("set status = 'paid'")
      )
    ).toBe(false);
  });

  it("resolves a public buyer before granting a reconciled payment", async () => {
    const publicOrder = {
      ...orderRow,
      buyer_identity_status: "pending",
      provider_customer_id: "cus-public",
      provider_payment_status: null,
      status: "pending",
      user_id: null,
    };
    const confirmedPayment = {
      ...payment,
      customer: "cus-public",
      refunds: [],
      status: "RECEIVED",
    };
    const client = {
      query: vi.fn((text: string) => {
        if (text.includes("set status = 'paid'")) {
          return Promise.resolve({ rows: [{ id: "order-1" }] });
        }
        if (text.includes("provider_customer_id =")) {
          return Promise.resolve({ rows: [{ id: "order-1" }] });
        }
        return Promise.resolve(
          text.includes("from orders") ? { rows: [publicOrder] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [publicOrder] }),
    });
    dependencies.resolveLocalOrderIdentity.mockResolvedValue({
      activationRequired: true,
      userId: "new-user",
    });
    const gateway = new FakeAsaasGateway({ getPayment: confirmedPayment });
    gateway.customers.set("cus-public", {
      email: "public@example.com",
      id: "cus-public",
      name: "Public Buyer",
    });

    await reconcileAsaasPayment({
      actorUserId: "admin-1",
      gateway,
      orderId: "order-1",
    });

    expect(gateway.calls.getCustomer).toEqual(["cus-public"]);
    expect(dependencies.resolveLocalOrderIdentity).toHaveBeenCalledWith({
      client,
      order: {
        buyerIdentityStatus: "pending",
        courseId: "course-1",
        customerEmail: "public@example.com",
        customerName: "Public Buyer",
        orderId: "order-1",
        userId: null,
      },
    });
    expect(dependencies.applyPaidWebhookAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        userId: "new-user",
      })
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        topic: "auth.account-activation",
      }),
    });
  });

  it("preserves a confirmed public payment and opens identity review for invalid customer data", async () => {
    const publicOrder = {
      ...orderRow,
      buyer_identity_status: "pending",
      provider_customer_id: "cus-invalid",
      provider_payment_status: null,
      status: "pending",
      user_id: null,
    };
    const confirmedPayment = {
      ...payment,
      customer: "cus-invalid",
      refunds: [],
      status: "RECEIVED",
    };
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        if (text.includes("from orders")) {
          return Promise.resolve({ rows: [publicOrder] });
        }
        if (text.includes("set status = 'paid'")) {
          return Promise.resolve({ rows: [{ id: "order-1" }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [publicOrder] }),
    });
    const gateway = new FakeAsaasGateway({ getPayment: confirmedPayment });
    gateway.customers.set("cus-invalid", {
      email: "invalid-email",
      id: "cus-invalid",
      name: "Public Buyer",
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway,
        orderId: "order-1",
      })
    ).resolves.toBeUndefined();

    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual(["order-1", "buyer_identity", "buyer_identity_invalid"]);
    expect(
      transactionQueries.some(({ text }) =>
        text.includes("set status = 'paid'")
      )
    ).toBe(true);
    expect(client.query).toHaveBeenCalledWith("commit");
  });

  it("preserves payment but blocks access when the public email belongs to a team account", async () => {
    const publicOrder = {
      ...orderRow,
      buyer_identity_status: "pending",
      provider_customer_id: "cus-team",
      provider_payment_status: null,
      status: "pending",
      user_id: null,
    };
    const confirmedPayment = {
      ...payment,
      customer: "cus-team",
      refunds: [],
      status: "RECEIVED",
    };
    const transactionQueries: Array<{
      text: string;
      values?: unknown[];
    }> = [];
    const client = {
      query: vi.fn((text: string, values?: unknown[]) => {
        transactionQueries.push(values ? { text, values } : { text });
        if (
          text.includes("set status = 'paid'") ||
          text.includes("provider_customer_id =")
        ) {
          return Promise.resolve({ rows: [{ id: "order-1" }] });
        }
        return Promise.resolve(
          text.includes("from orders") ? { rows: [publicOrder] } : { rows: [] }
        );
      }),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [publicOrder] }),
    });
    dependencies.resolveLocalOrderIdentity.mockRejectedValue(
      new dependencies.LocalOrderIdentityError("buyer_identity_team_account")
    );
    const gateway = new FakeAsaasGateway({ getPayment: confirmedPayment });
    gateway.customers.set("cus-team", {
      email: "admin@example.com",
      id: "cus-team",
      name: "Team Account",
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway,
        orderId: "order-1",
      })
    ).resolves.toBeUndefined();

    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(
      transactionQueries.find(({ text }) =>
        text.includes("insert into payment_reviews")
      )?.values
    ).toEqual(["order-1", "buyer_identity", "buyer_identity_team_account"]);
    expect(client.query).toHaveBeenCalledWith("commit");
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

  it("reconciles an Invoice payment only through its exact external reference", async () => {
    const invoiceOrder = {
      ...orderRow,
      provider_checkout_id: null,
      provider_purchase_flow: "invoice",
    };
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve(
          text.includes("from orders") ? { rows: [invoiceOrder] } : { rows: [] }
        )
      ),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [invoiceOrder] }),
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway: new FakeAsaasGateway({
          getPayment: {
            ...payment,
            checkoutSession: null,
          },
        }),
        orderId: "order-1",
      })
    ).resolves.toBeUndefined();
  });

  it("rejects an Invoice payment without its exact external reference", async () => {
    const invoiceOrder = {
      ...orderRow,
      provider_checkout_id: null,
      provider_purchase_flow: "invoice",
    };
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [invoiceOrder] }),
    });

    await expect(
      reconcileAsaasPayment({
        actorUserId: "admin-1",
        gateway: new FakeAsaasGateway({
          getPayment: {
            ...payment,
            checkoutSession: null,
            externalReference: null,
          },
        }),
        orderId: "order-1",
      })
    ).rejects.toThrow("A consulta Asaas nao corresponde ao Pedido informado.");
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

  it("reconciles an Invoice installment through every exact external reference", async () => {
    const invoiceOrder = {
      ...orderRow,
      buyer_identity_status: "review_required",
      provider_checkout_id: null,
      provider_installment_id: "ins-1",
      provider_purchase_flow: "invoice",
      user_id: null,
    };
    const client = {
      query: vi.fn((text: string) =>
        Promise.resolve(
          text.includes("from orders") ? { rows: [invoiceOrder] } : { rows: [] }
        )
      ),
      release: vi.fn(),
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [invoiceOrder] }),
    });
    const invoiceInstallmentPayment = {
      ...payment,
      billingType: "CREDIT_CARD",
      checkoutSession: null,
      installmentId: "ins-1",
      refunds: [],
      status: "RECEIVED",
      valueInCents: 4330,
    };
    const gateway = new FakeAsaasGateway({
      getInstallment: {
        billingType: "CREDIT_CARD",
        checkoutSession: null,
        id: "ins-1",
        installmentCount: 3,
        netValueInCents: 12_500,
        paymentValueInCents: 4330,
        refunds: [],
        valueInCents: 12_990,
      },
      listInstallmentPayments: {
        data: [
          invoiceInstallmentPayment,
          { ...invoiceInstallmentPayment, id: "pay-2" },
          { ...invoiceInstallmentPayment, id: "pay-3" },
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

  it("reports inserted and updated statement rows separately", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ next_offset: 0 }] });
    const clientQuery = vi.fn((text: string) => {
      if (text.includes("select next_offset")) {
        return Promise.resolve({ rows: [{ next_offset: 0 }] });
      }
      if (text.includes("with incoming")) {
        return Promise.resolve({ rows: [{ inserted: "1", updated: "0" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query: clientQuery,
        release: vi.fn(),
      }),
      query,
    });
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
    ).resolves.toEqual({
      completed: true,
      inserted: 1,
      resumedFromOffset: 0,
      updated: 0,
    });

    expect(gateway.calls.listFinancialTransactions).toEqual([
      {
        finishDate: "2026-07-28",
        limit: 100,
        offset: 0,
        order: "asc",
        startDate: "2026-07-28",
      },
    ]);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("jsonb_to_recordset"),
      [
        JSON.stringify([
          {
            providerTransactionId: "ft-1",
            transactionDate: "2026-07-28",
            transactionType: "PAYMENT_FEE",
            valueInCents: -299,
          },
        ]),
      ]
    );
  });

  it("resumes from the committed page cursor after a later page fails", async () => {
    let cursorOffset = 0;
    const persistedProviderIds = new Set<string>();
    const poolQuery = vi.fn(() =>
      Promise.resolve({ rows: [{ next_offset: cursorOffset }] })
    );
    const clientQuery = vi.fn((text: string, values?: unknown[]) => {
      if (text.includes("select next_offset")) {
        return Promise.resolve({ rows: [{ next_offset: cursorOffset }] });
      }
      if (text.includes("with incoming")) {
        const rows = JSON.parse(String(values?.[0])) as Array<{
          providerTransactionId: string;
        }>;
        let inserted = 0;
        let updated = 0;
        for (const row of rows) {
          if (persistedProviderIds.has(row.providerTransactionId)) {
            updated += 1;
          } else {
            persistedProviderIds.add(row.providerTransactionId);
            inserted += 1;
          }
        }
        return Promise.resolve({
          rows: [{ inserted: String(inserted), updated: String(updated) }],
        });
      }
      if (text.includes("update asaas_statement_import_cursors")) {
        cursorOffset = Number(values?.[1]);
      }
      return Promise.resolve({ rows: [] });
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query: clientQuery,
        release: vi.fn(),
      }),
      query: poolQuery,
    });

    const gateway = new FakeAsaasGateway({
      listFinancialTransactions: new Error("unused"),
    });
    let failSecondPage = true;
    gateway.listFinancialTransactions = vi.fn(({ offset = 0 }) => {
      if (offset === 100 && failSecondPage) {
        failSecondPage = false;
        return Promise.reject(new Error("provider unavailable"));
      }
      return Promise.resolve({
        data: [
          {
            date: "2026-07-28",
            id: offset === 0 ? "ft-1" : "ft-2",
            type: "PAYMENT_FEE",
            valueInCents: -299,
          },
        ],
        hasMore: offset === 0,
        limit: 100,
        object: "list",
        offset,
        totalCount: 2,
      });
    });

    await expect(
      importAsaasFinancialStatement({
        actorUserId: "admin-1",
        finishDate: "2026-07-28",
        gateway,
        startDate: "2026-07-28",
      })
    ).rejects.toThrow("provider unavailable");
    expect(cursorOffset).toBe(100);

    await expect(
      importAsaasFinancialStatement({
        actorUserId: "admin-1",
        finishDate: "2026-07-28",
        gateway,
        startDate: "2026-07-28",
      })
    ).resolves.toEqual({
      completed: true,
      inserted: 1,
      resumedFromOffset: 100,
      updated: 0,
    });
    expect(persistedProviderIds).toEqual(new Set(["ft-1", "ft-2"]));
    expect(gateway.listFinancialTransactions).toHaveBeenCalledTimes(3);
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
