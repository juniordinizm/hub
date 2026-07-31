import { describe, expect, it } from "vitest";
import { parseAsaasWebhookEnvelope } from "./asaas-financial-events";

describe("parseAsaasWebhookEnvelope", () => {
  it("accepts payment events, unknown statuses, and extra provider fields", () => {
    expect(
      parseAsaasWebhookEnvelope({
        dateCreated: "2026-07-28 20:00:00",
        event: "PAYMENT_FUTURE_EVENT",
        futureEnvelopeField: { anything: true },
        id: "evt_123",
        payment: {
          billingType: "FUTURE_METHOD",
          futurePaymentField: "preserved by provider payload storage",
          id: "pay_123",
          status: "FUTURE_STATUS",
        },
      })
    ).toEqual({
      dateCreated: "2026-07-28 20:00:00",
      event: "PAYMENT_FUTURE_EVENT",
      key: "evt_123",
      subject: {
        id: "pay_123",
        kind: "payment",
        status: "FUTURE_STATUS",
      },
    });
  });

  it("accepts checkout events with an unknown checkout status", () => {
    expect(
      parseAsaasWebhookEnvelope({
        checkout: {
          id: "chk_123",
          status: "FUTURE_STATUS",
        },
        event: "CHECKOUT_FUTURE_EVENT",
        id: "evt_456",
      })
    ).toEqual({
      dateCreated: null,
      event: "CHECKOUT_FUTURE_EVENT",
      key: "evt_456",
      subject: {
        id: "chk_123",
        kind: "checkout",
        status: "FUTURE_STATUS",
      },
    });
  });

  it("accepts an unknown event family without assuming a subject", () => {
    expect(
      parseAsaasWebhookEnvelope({
        event: "FUTURE_DOMAIN_EVENT",
        id: "evt_789",
      })
    ).toEqual({
      dateCreated: null,
      event: "FUTURE_DOMAIN_EVENT",
      key: "evt_789",
      subject: {
        id: null,
        kind: "unknown",
        status: null,
      },
    });
  });

  it("accepts a future prefixed event with only the durable inbox identity", () => {
    expect(
      parseAsaasWebhookEnvelope({
        event: "PAYMENT_FUTURE_EVENT",
        id: "evt_future_payment",
      })
    ).toEqual({
      dateCreated: null,
      event: "PAYMENT_FUTURE_EVENT",
      key: "evt_future_payment",
      subject: {
        id: null,
        kind: "unknown",
        status: null,
      },
    });
  });

  it.each([
    null,
    {},
    { event: "PAYMENT_RECEIVED" },
    { event: "PAYMENT_RECEIVED", id: "evt_1" },
    {
      checkout: { id: "chk_1", status: "ACTIVE" },
      event: "PAYMENT_RECEIVED",
      id: "evt_1",
    },
    {
      event: "CHECKOUT_CREATED",
      id: "evt_1",
      payment: { id: "pay_1", status: "PENDING" },
    },
    {
      event: "CHECKOUT_CREATED",
      id: "evt_1",
      checkout: { id: "chk_1" },
    },
    {
      event: "PAYMENT_REFUNDED",
      id: "evt_refunded_without_payment",
    },
    {
      event: "PAYMENT_PARTIALLY_REFUNDED",
      id: "evt_partial_without_payment",
    },
    {
      event: "PAYMENT_CHARGEBACK_REQUESTED",
      id: "evt_chargeback_without_payment",
    },
    {
      event: "PAYMENT_CHARGEBACK_DISPUTE",
      id: "evt_dispute_without_payment",
    },
    {
      event: "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      id: "evt_reversal_without_payment",
    },
    {
      event: "PAYMENT_RECEIVED",
      id: "evt_received_without_billing_type",
      payment: { id: "pay_1", status: "RECEIVED", value: 100 },
    },
    {
      event: "PAYMENT_CONFIRMED",
      id: "evt_confirmed_without_value",
      payment: {
        billingType: "CREDIT_CARD",
        id: "pay_1",
        status: "CONFIRMED",
      },
    },
    {
      event: "PAYMENT_REFUNDED",
      id: "evt_refunded_with_invalid_value",
      payment: {
        billingType: "CREDIT_CARD",
        id: "pay_1",
        status: "REFUNDED",
        value: "100",
      },
    },
    {
      event: "PAYMENT_CHARGEBACK_DISPUTE",
      id: "evt_dispute_with_fractional_value",
      payment: {
        billingType: "CREDIT_CARD",
        id: "pay_1",
        status: "DISPUTED",
        value: 100.001,
      },
    },
    {
      event: "PAYMENT_REFUND_IN_PROGRESS",
      id: "evt_refund_progress_without_value",
      payment: {
        billingType: "CREDIT_CARD",
        id: "pay_1",
        status: "REFUND_IN_PROGRESS",
      },
    },
    {
      event: "PAYMENT_REFUND_DENIED",
      id: "evt_refund_denied_without_billing",
      payment: {
        id: "pay_1",
        status: "REFUND_DENIED",
        value: 100,
      },
    },
  ])("rejects malformed or mismatched envelopes: %j", (payload) => {
    expect(parseAsaasWebhookEnvelope(payload)).toBeNull();
  });
});
