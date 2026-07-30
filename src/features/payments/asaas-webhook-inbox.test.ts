import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AsaasWebhookInputError,
  persistAsaasWebhook,
  verifyAsaasWebhookToken,
} from "./asaas-webhook-inbox";

const WEBHOOK_TOKEN = "asaas-webhook-token-at-least-thirty-two-characters";

const paymentEvent = {
  dateCreated: "2026-07-29T12:00:00Z",
  event: "PAYMENT_RECEIVED",
  id: "evt_123",
  payment: {
    billingType: "PIX",
    id: "pay_123",
    status: "RECEIVED",
    value: 100,
  },
};

describe("Asaas webhook inbox", () => {
  it("authenticates only a strong exact token", () => {
    expect(
      verifyAsaasWebhookToken({
        expectedToken: WEBHOOK_TOKEN,
        receivedToken: WEBHOOK_TOKEN,
      })
    ).toBe(true);
    expect(
      verifyAsaasWebhookToken({
        expectedToken: WEBHOOK_TOKEN,
        receivedToken: "wrong-token-with-at-least-thirty-two-characters",
      })
    ).toBe(false);
    expect(
      verifyAsaasWebhookToken({
        expectedToken: "short",
        receivedToken: "short",
      })
    ).toBe(false);
    expect(
      verifyAsaasWebhookToken({
        expectedToken: undefined,
        receivedToken: WEBHOOK_TOKEN,
      })
    ).toBe(false);
  });

  it("persists a structurally valid event before acknowledging it", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "inbox-1" }] });

    await expect(
      persistAsaasWebhook({
        client: { query } as never,
        payload: paymentEvent,
      })
    ).resolves.toEqual({ duplicate: false, id: "inbox-1" });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (provider, event_key) do nothing"),
      ["evt_123", "PAYMENT_RECEIVED", JSON.stringify(paymentEvent)]
    );
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "now() + interval '30 days'"
    );
  });

  it("acknowledges a duplicate without processing business effects", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      persistAsaasWebhook({
        client: { query } as never,
        payload: paymentEvent,
      })
    ).resolves.toEqual({ duplicate: true, id: null });

    expect(query).toHaveBeenCalledOnce();
  });

  it("persists an unknown event name for later safe classification", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "inbox-2" }] });
    const payload = {
      event: "FUTURE_EVENT",
      id: "evt_future",
      personalData: "retained only in the bounded raw payload",
    };

    await persistAsaasWebhook({
      client: { query } as never,
      payload,
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "evt_future",
      "FUTURE_EVENT",
      JSON.stringify(payload),
    ]);
  });

  it.each([
    null,
    {},
    { event: "PAYMENT_RECEIVED", id: "evt_missing_payment" },
    { event: "PAYMENT_RECEIVED", id: "evt_bad_payment", payment: {} },
  ])("rejects malformed or structurally invalid payload: %#", async (payload) => {
    const query = vi.fn();

    await expect(
      persistAsaasWebhook({
        client: { query } as never,
        payload,
      })
    ).rejects.toBeInstanceOf(AsaasWebhookInputError);
    expect(query).not.toHaveBeenCalled();
  });
});
