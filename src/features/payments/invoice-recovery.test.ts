import { describe, expect, it, vi } from "vitest";
import type { AsaasPayment } from "./asaas";
import { recoverAsaasInvoice } from "./invoice-recovery";

const payment: AsaasPayment = {
  billingType: "CREDIT_CARD",
  checkoutSession: null,
  customer: "cus_asaas",
  externalReference: "order_attempt",
  id: "pay_asaas",
  installmentId: "ins_asaas",
  invoiceUrl: "https://sandbox.asaas.com/i/pay_asaas",
  netValueInCents: 3217,
  refunds: [],
  status: "PENDING",
  valueInCents: 3349,
};

describe("Asaas invoice recovery", () => {
  it("recovers an exact installment aggregate without repeating creation", async () => {
    const markRecovered = vi.fn();
    const gateway = {
      getInstallment: vi.fn(async () => ({
        billingType: "CREDIT_CARD",
        checkoutSession: null,
        id: "ins_asaas",
        installmentCount: 3,
        netValueInCents: 9652,
        paymentValueInCents: 3349,
        refunds: [],
        valueInCents: 10_048,
      })),
      listPayments: vi.fn(async () => ({ data: [payment] })),
    };

    await expect(
      recoverAsaasInvoice({
        gateway,
        intent: {
          amountInCents: 10_048,
          billingType: "CREDIT_CARD",
          externalReference: "order_attempt",
          installmentCount: 3,
          orderId: "attempt",
          providerCustomerId: "cus_asaas",
        },
        markRecovered,
        markReview: vi.fn(),
      })
    ).resolves.toEqual({
      orderId: "attempt",
      redirectUrl: payment.invoiceUrl,
      status: "ready",
    });
    expect(markRecovered).toHaveBeenCalledWith({
      installmentId: "ins_asaas",
      invoiceUrl: payment.invoiceUrl,
      orderId: "attempt",
      paymentId: "pay_asaas",
      providerStatus: "PENDING",
    });
  });

  it("opens review instead of choosing between duplicate provider effects", async () => {
    const markReview = vi.fn();
    const gateway = {
      getInstallment: vi.fn(),
      listPayments: vi.fn(async () => ({
        data: [
          payment,
          {
            ...payment,
            id: "pay_duplicate",
            installmentId: "ins_duplicate",
          },
        ],
      })),
    };

    await expect(
      recoverAsaasInvoice({
        gateway,
        intent: {
          amountInCents: 10_048,
          billingType: "CREDIT_CARD",
          externalReference: "order_attempt",
          installmentCount: 3,
          orderId: "attempt",
          providerCustomerId: "cus_asaas",
        },
        markRecovered: vi.fn(),
        markReview,
      })
    ).resolves.toEqual({ orderId: "attempt", status: "processing" });
    expect(markReview).toHaveBeenCalledWith("attempt");
    expect(gateway.getInstallment).not.toHaveBeenCalled();
  });
});
