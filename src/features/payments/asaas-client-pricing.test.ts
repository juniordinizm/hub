import { describe, expect, it, vi } from "vitest";
import { AsaasClient } from "./asaas-client";

const createClient = (fetcher: typeof fetch): AsaasClient =>
  new AsaasClient({
    accessToken: "sandbox-token",
    baseUrl: "https://api-sandbox.asaas.com",
    fetcher,
    userAgent: "Hub/1.0 payments@example.com",
  });

describe("AsaasClient pricing and invoice contracts", () => {
  it("retrieves the account credit-card fee schedule", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        anticipation: { creditCard: { installmentFee: 1.7 } },
        payment: {
          creditCard: {
            discountExpiration: "2026-08-31",
            discountOneInstallmentPercentage: 2.49,
            discountUpToSixInstallmentsPercentage: 2.99,
            discountUpToTwelveInstallmentsPercentage: 3.49,
            oneInstallmentPercentage: 2.99,
            operationValue: 0.49,
            upToSixInstallmentsPercentage: 3.49,
            upToTwelveInstallmentsPercentage: 3.99,
          },
        },
      })
    );

    await expect(createClient(fetcher).getAccountFees()).resolves.toEqual({
      discountExpiration: "2026-08-31",
      oneInstallmentPercentageBasisPoints: 299,
      operationFeeInCents: 49,
      promotionalOneInstallmentPercentageBasisPoints: 249,
      promotionalUpToSixInstallmentsPercentageBasisPoints: 299,
      promotionalUpToTwelveInstallmentsPercentageBasisPoints: 349,
      upToSixInstallmentsPercentageBasisPoints: 349,
      upToTwelveInstallmentsPercentageBasisPoints: 399,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/myAccount/fees/",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("simulates a card installment and converts every monetary value", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        creditCard: {
          feePercentage: 3.49,
          installment: {
            paymentNetValue: 32.17,
            paymentValue: 33.49,
          },
          netValue: 96.52,
          operationFee: 0.49,
        },
      })
    );

    await expect(
      createClient(fetcher).simulatePayment({
        billingType: "CREDIT_CARD",
        installmentCount: 3,
        valueInCents: 10_048,
      })
    ).resolves.toEqual({
      feePercentageBasisPoints: 349,
      installmentAmountInCents: 3349,
      installmentNetAmountInCents: 3217,
      netAmountInCents: 9652,
      operationFeeInCents: 49,
    });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      billingTypes: ["CREDIT_CARD"],
      installmentCount: 3,
      value: 100.48,
    });
  });

  it("creates a customer without exposing the document in its result", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        cpfCnpj: "39052900060",
        email: "aluna@example.com",
        externalReference: "buyer_123",
        id: "cus_123",
        name: "Aluna Teste",
      })
    );

    await expect(
      createClient(fetcher).createCustomer({
        cpfCnpj: "39052900060",
        email: "aluna@example.com",
        externalReference: "buyer_123",
        name: "Aluna Teste",
      })
    ).resolves.toEqual({
      email: "aluna@example.com",
      externalReference: "buyer_123",
      id: "cus_123",
      name: "Aluna Teste",
    });
  });

  it("lists customers by exact external reference", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            email: "aluna@example.com",
            externalReference: "buyer_123",
            id: "cus_123",
            name: "Aluna Teste",
          },
        ],
        hasMore: false,
        limit: 100,
        object: "list",
        offset: 0,
        totalCount: 1,
      })
    );

    await expect(
      createClient(fetcher).listCustomers({ externalReference: "buyer_123" })
    ).resolves.toMatchObject({ totalCount: 1 });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/customers?externalReference=buyer_123&limit=100"
    );
  });

  it("creates a one-time card invoice without receiving card data", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "pay_123",
        installment: null,
        invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
        status: "PENDING",
      })
    );

    await expect(
      createClient(fetcher).createPayment({
        billingType: "CREDIT_CARD",
        customerId: "cus_123",
        description: "Curso Teste",
        dueDate: "2026-08-04",
        externalReference: "order_123",
        installmentCount: 1,
        totalAmountInCents: 10_000,
      })
    ).resolves.toEqual({
      id: "pay_123",
      installmentId: null,
      invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
      status: "PENDING",
    });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      billingType: "CREDIT_CARD",
      customer: "cus_123",
      description: "Curso Teste",
      dueDate: "2026-08-04",
      externalReference: "order_123",
      value: 100,
    });
  });

  it("creates a fixed-count installment using the final gross total", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "pay_123",
        installment: "ins_123",
        invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
        status: "PENDING",
      })
    );

    await createClient(fetcher).createPayment({
      billingType: "CREDIT_CARD",
      callback: {
        autoRedirect: true,
        successUrl: "https://preview.neurocapacitar.com.br/checkout/sucesso",
      },
      customerId: "cus_123",
      description: "Curso Teste",
      dueDate: "2026-08-04",
      externalReference: "order_123",
      installmentCount: 3,
      totalAmountInCents: 10_048,
    });

    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      billingType: "CREDIT_CARD",
      callback: {
        autoRedirect: true,
        successUrl: "https://preview.neurocapacitar.com.br/checkout/sucesso",
      },
      customer: "cus_123",
      description: "Curso Teste",
      dueDate: "2026-08-04",
      externalReference: "order_123",
      installmentCount: 3,
      totalValue: 100.48,
    });
  });

  it("rejects an unexpected invoice host as an unknown mutation result", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: "pay_123",
        installment: null,
        invoiceUrl: "https://asaas.example.com/i/pay_123",
        status: "PENDING",
      })
    );

    await expect(
      createClient(fetcher).createPayment({
        billingType: "PIX",
        customerId: "cus_123",
        description: "Curso Teste",
        dueDate: "2026-08-04",
        externalReference: "order_123",
        installmentCount: 1,
        totalAmountInCents: 10_000,
      })
    ).rejects.toMatchObject({
      kind: "invalid_response",
      outcome: "unknown",
      retryable: false,
    });
  });
});
