import { describe, expect, it } from "vitest";
import { AsaasGatewayError } from "./asaas-client";
import { FakeAsaasGateway } from "./fake-asaas-gateway";

const CUSTOMER_ID_OR_PII_RE = /cus_missing|aluna@example|12345678900/;

const checkout = {
  id: "chk_123",
  link: "https://asaas.test/chk_123",
  status: "ACTIVE",
};

const payment = {
  billingType: "PIX",
  checkoutSession: "chk_123",
  customer: "cus_123",
  externalReference: "order_123",
  id: "pay_123",
  netValueInCents: 970,
  refunds: [],
  status: "RECEIVED",
  valueInCents: 1000,
};

describe("FakeAsaasGateway", () => {
  it("returns a defensive customer copy and reports a safe not found error", async () => {
    const fake = new FakeAsaasGateway({});
    fake.customers.set("cus_123", {
      email: "aluna@example.com",
      id: "cus_123",
      name: "Aluna Teste",
    });

    const customer = await fake.getCustomer("cus_123");
    customer.name = "Alterado fora do fake";

    await expect(fake.getCustomer("cus_123")).resolves.toEqual({
      email: "aluna@example.com",
      id: "cus_123",
      name: "Aluna Teste",
    });
    const missingCustomerId = "cus_missing-aluna@example.com-12345678900";
    const missingCustomer = fake.getCustomer(missingCustomerId);
    await expect(missingCustomer).rejects.toBeInstanceOf(AsaasGatewayError);
    await expect(missingCustomer).rejects.toMatchObject({
      kind: "not_found",
      outcome: "rejected",
      retryable: false,
    });
    await expect(missingCustomer).rejects.not.toThrow(CUSTOMER_ID_OR_PII_RE);
    expect(fake.calls.getCustomer).toEqual([
      "cus_123",
      "cus_123",
      missingCustomerId,
    ]);
  });

  it("implements the gateway contract and records every deterministic call", async () => {
    const fake = new FakeAsaasGateway({
      cancelCheckout: checkout,
      createCheckout: checkout,
      createCustomer: {
        email: "aluna@example.com",
        externalReference: "buyer_123",
        id: "cus_123",
        name: "Aluna Teste",
      },
      createPayment: {
        id: "pay_123",
        installmentId: null,
        invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
        status: "PENDING",
      },
      getAccountFees: {
        oneInstallmentPercentageBasisPoints: 299,
        operationFeeInCents: 49,
        upToSixInstallmentsPercentageBasisPoints: 349,
        upToTwelveInstallmentsPercentageBasisPoints: 399,
      },
      getPayment: payment,
      listCustomers: {
        data: [],
        hasMore: false,
        limit: 100,
        object: "list",
        offset: 0,
        totalCount: 0,
      },
      listPayments: {
        data: [payment],
        hasMore: false,
        limit: 20,
        object: "list",
        offset: 0,
        totalCount: 1,
      },
      refundPayment: {
        ...payment,
        refunds: [
          {
            dateCreated: "2026-07-28",
            status: "DONE",
            valueInCents: 1000,
          },
        ],
        status: "REFUNDED",
      },
      simulatePayment: {
        feePercentageBasisPoints: 299,
        installmentAmountInCents: 10_000,
        installmentNetAmountInCents: 9652,
        netAmountInCents: 9652,
        operationFeeInCents: 49,
      },
    });
    const createInput = {
      callback: {
        cancelUrl: "https://hub.test/cancel",
        expiredUrl: "https://hub.test/expired",
        successUrl: "https://hub.test/success",
      },
      expirationMinutes: 30,
      externalReference: "order_123",
      item: {
        description: "Acesso",
        name: "Curso",
        valueInCents: 1000,
      },
      paymentOptions: {
        allowCreditCard: true,
        allowPix: true,
        maxInstallmentCount: 1,
      },
    };

    await expect(fake.createCheckout(createInput)).resolves.toEqual(checkout);
    const createCustomerInput = {
      cpfCnpj: "39052900060",
      email: "aluna@example.com",
      externalReference: "buyer_123",
      name: "Aluna Teste",
    };
    await fake.createCustomer(createCustomerInput);
    const createPaymentInput = {
      billingType: "PIX" as const,
      customerId: "cus_123",
      description: "Curso",
      dueDate: "2026-08-04",
      externalReference: "order_123",
      installmentCount: 1,
      totalAmountInCents: 1000,
    };
    await fake.createPayment(createPaymentInput);
    await fake.getAccountFees();
    await fake.listCustomers({ externalReference: "buyer_123" });
    const simulationInput = {
      billingType: "CREDIT_CARD" as const,
      installmentCount: 1,
      valueInCents: 10_000,
    };
    await fake.simulatePayment(simulationInput);
    await expect(fake.cancelCheckout("chk_123")).resolves.toEqual(checkout);
    await expect(fake.getPayment("pay_123")).resolves.toEqual(payment);
    await expect(
      fake.listPayments({ externalReference: "order_123", limit: 20 })
    ).resolves.toMatchObject({ totalCount: 1 });
    await expect(
      fake.refundPayment({
        description: "Solicitacao aprovada",
        paymentId: "pay_123",
      })
    ).resolves.toMatchObject({ status: "REFUNDED" });

    expect(fake.calls).toEqual({
      cancelCheckout: ["chk_123"],
      createCheckout: [createInput],
      createCustomer: [createCustomerInput],
      createPayment: [createPaymentInput],
      getAccountFees: 1,
      getCustomer: [],
      getInstallment: [],
      getPayment: ["pay_123"],
      listFinancialTransactions: [],
      listCustomers: [{ externalReference: "buyer_123" }],
      listInstallmentPayments: [],
      listPayments: [{ externalReference: "order_123", limit: 20 }],
      refundInstallment: [],
      refundPayment: [
        {
          description: "Solicitacao aprovada",
          paymentId: "pay_123",
        },
      ],
      simulatePayment: [simulationInput],
    });
  });

  it("throws the exact configured safe error and still records the call", async () => {
    const configuredError = new AsaasGatewayError({
      kind: "timeout",
      message: "Tempo limite da comunicacao com Asaas excedido.",
      outcome: "unknown",
      retryable: true,
    });
    const fake = new FakeAsaasGateway({ refundPayment: configuredError });
    const input = {
      description: "Solicitacao aprovada",
      paymentId: "pay_123",
    };

    await expect(fake.refundPayment(input)).rejects.toBe(configuredError);
    expect(fake.calls.refundPayment).toEqual([input]);
  });
});
