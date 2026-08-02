import { describe, expect, it } from "vitest";
import type { AsaasInstallment } from "./asaas";
import {
  getAsaasPaymentInstallmentId,
  materializeAsaasInstallmentPayload,
} from "./asaas-installment-events";

const installment: AsaasInstallment = {
  billingType: "CREDIT_CARD",
  checkoutSession: "chk_123",
  id: "ins_123",
  installmentCount: 3,
  netValueInCents: 28_500,
  paymentValueInCents: 10_000,
  refunds: [],
  valueInCents: 30_000,
};

const payload = {
  event: "PAYMENT_CONFIRMED",
  payment: {
    billingType: "CREDIT_CARD",
    checkoutSession: "chk_123",
    customer: "cus_123",
    id: "pay_1",
    installment: "ins_123",
    netValue: 95,
    status: "CONFIRMED",
    value: 100,
  },
};

describe("Asaas installment events", () => {
  it("extracts only a non-empty installment identifier", () => {
    expect(getAsaasPaymentInstallmentId(payload)).toBe("ins_123");
    expect(
      getAsaasPaymentInstallmentId({ payment: { installment: "" } })
    ).toBeNull();
    expect(getAsaasPaymentInstallmentId({})).toBeNull();
  });

  it("materializes aggregate money without mutating the raw webhook", () => {
    const materialized = materializeAsaasInstallmentPayload({
      installment,
      payload,
    }) as typeof payload;

    expect(materialized.payment.value).toBe(300);
    expect(materialized.payment.netValue).toBe(285);
    expect(payload.payment.value).toBe(100);
  });

  it("rejects a mismatched checkout session", () => {
    expect(() =>
      materializeAsaasInstallmentPayload({
        installment: { ...installment, checkoutSession: "chk_other" },
        payload,
      })
    ).toThrow("asaas_installment_correlation_invalid");
  });

  it("rejects a non-card aggregate", () => {
    expect(() =>
      materializeAsaasInstallmentPayload({
        installment: { ...installment, billingType: "PIX" },
        payload,
      })
    ).toThrow("asaas_installment_contract_invalid");
  });
});
