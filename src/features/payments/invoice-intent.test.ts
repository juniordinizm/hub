import { describe, expect, it, vi } from "vitest";
import { AsaasGatewayError } from "./asaas-client";
import {
  createAsaasInvoiceIntent,
  type InvoiceIntentStore,
  type PreparedInvoiceIntent,
} from "./invoice-intent";

const prepared: PreparedInvoiceIntent = {
  amountInCents: 10_048,
  baseAmountInCents: 10_000,
  cardPricingPolicy: "buyer_pays_incremental_installment_cost",
  courseDescription: "Curso",
  customerEmail: "buyer@example.com",
  customerName: "Compradora",
  externalReference: "order_7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  installmentCount: 3,
  orderId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  paymentMethod: "credit_card",
  surchargeAmountInCents: 48,
};

const createStore = (): InvoiceIntentStore => ({
  claimCreating: vi.fn(async () => true),
  markFailed: vi.fn(),
  markReady: vi.fn(async () => true),
  markUncertain: vi.fn(),
  prepare: vi.fn(async () => ({
    intent: prepared,
    status: "created" as const,
  })),
  setProviderCustomer: vi.fn(),
});

describe("Asaas invoice intent", () => {
  it("persists the snapshot before creating a customer or payment", async () => {
    const order: string[] = [];
    const store = createStore();
    store.prepare = vi.fn(() => {
      order.push("prepare");
      return Promise.resolve({ intent: prepared, status: "created" as const });
    });
    const resolveCustomer = vi.fn(() => {
      order.push("customer");
      return Promise.resolve({
        providerCustomerId: "cus_asaas",
        status: "ready" as const,
      });
    });
    const gateway = {
      createPayment: vi.fn(() => {
        order.push("payment");
        return Promise.resolve({
          id: "pay_asaas",
          installmentId: "ins_asaas",
          invoiceUrl: "https://sandbox.asaas.com/i/pay_asaas",
          status: "PENDING",
        });
      }),
    };

    await expect(
      createAsaasInvoiceIntent({
        callbackUrl: "https://preview.neurocapacitar.com.br/checkout/sucesso",
        gateway,
        input: {
          courseSlug: "curso",
          cpfCnpj: "39053344705",
          email: "buyer@example.com",
          installmentCount: 3,
          name: "Compradora",
          paymentMethod: "credit_card",
          purchaseAttemptId: prepared.orderId,
          quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
        },
        now: () => new Date("2026-08-03T23:59:00-03:00"),
        resolveCustomer,
        store,
      })
    ).resolves.toEqual({
      orderId: prepared.orderId,
      redirectUrl: "https://sandbox.asaas.com/i/pay_asaas",
      status: "ready",
    });
    expect(order).toEqual(["prepare", "customer", "payment"]);
    expect(gateway.createPayment).toHaveBeenCalledWith({
      billingType: "CREDIT_CARD",
      callback: {
        autoRedirect: true,
        successUrl: "https://preview.neurocapacitar.com.br/checkout/sucesso",
      },
      customerId: "cus_asaas",
      description: "Curso",
      dueDate: "2026-08-04",
      externalReference: prepared.externalReference,
      installmentCount: 3,
      totalAmountInCents: 10_048,
    });
  });

  it("marks a payment timeout uncertain and never reports failure as retryable", async () => {
    const store = createStore();
    const gateway = {
      createPayment: vi.fn(() =>
        Promise.reject(
          new AsaasGatewayError({
            kind: "timeout",
            message: "timeout",
            outcome: "unknown",
            retryable: false,
          })
        )
      ),
    };

    await expect(
      createAsaasInvoiceIntent({
        gateway,
        input: {
          courseSlug: "curso",
          cpfCnpj: "39053344705",
          email: "buyer@example.com",
          installmentCount: 3,
          name: "Compradora",
          paymentMethod: "credit_card",
          purchaseAttemptId: prepared.orderId,
          quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
        },
        resolveCustomer: async () => ({
          providerCustomerId: "cus_asaas",
          status: "ready",
        }),
        store,
      })
    ).resolves.toEqual({ orderId: prepared.orderId, status: "processing" });
    expect(store.markUncertain).toHaveBeenCalledWith(prepared.orderId);
  });

  it("fails only the order attempt when customer recovery remains uncertain", async () => {
    const store = createStore();
    const gateway = { createPayment: vi.fn() };

    await expect(
      createAsaasInvoiceIntent({
        gateway,
        input: {
          courseSlug: "curso",
          cpfCnpj: "39053344705",
          email: "buyer@example.com",
          installmentCount: 3,
          name: "Compradora",
          paymentMethod: "credit_card",
          purchaseAttemptId: prepared.orderId,
          quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
        },
        resolveCustomer: vi.fn(() =>
          Promise.resolve({ status: "processing" as const })
        ),
        store,
      })
    ).resolves.toEqual({ orderId: prepared.orderId, status: "failed" });

    expect(store.markFailed).toHaveBeenCalledWith(prepared.orderId);
    expect(store.markUncertain).not.toHaveBeenCalled();
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });
});
