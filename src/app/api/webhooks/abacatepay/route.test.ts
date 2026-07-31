import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  observeOperation: vi.fn(),
  processAbacatePayWebhook: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/server", () => ({
  processAbacatePayWebhook: dependencies.processAbacatePayWebhook,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));

import { POST } from "./route";

const WEBHOOK_SECRET = "legacy-webhook-secret";

describe("legacy AbacatePay webhook containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.observeOperation.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );
  });

  it("acknowledges disabled webhooks before reading or processing the request", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_WEBHOOK_ENABLED: false,
    });
    const request = new Request("https://hub.example/api/webhooks/abacatepay", {
      body: "{not-json",
      method: "POST",
    });
    const readBody = vi.spyOn(request, "text");

    const response = await POST(request);

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
    expect(readBody).not.toHaveBeenCalled();
    expect(dependencies.observeOperation).not.toHaveBeenCalled();
    expect(dependencies.processAbacatePayWebhook).not.toHaveBeenCalled();
  });

  it("keeps authenticated webhook processing active when enabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_WEBHOOK_ENABLED: true,
      ABACATEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      NODE_ENV: "test",
    });
    dependencies.processAbacatePayWebhook.mockResolvedValue({
      status: "processed",
    });
    const payload = JSON.stringify({
      event: "billing.paid",
      id: "evt_1",
    });
    const timestamp = "1705849200";
    const signature = createHmac("sha256", WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const request = new Request(
      `https://hub.example/api/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`,
      {
        body: payload,
        headers: {
          "x-webhook-signature": `t=${timestamp},v1=${signature}`,
        },
        method: "POST",
      }
    );
    const readBody = vi.spyOn(request, "text");

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "processed",
    });
    expect(readBody).toHaveBeenCalledOnce();
    expect(dependencies.processAbacatePayWebhook).toHaveBeenCalledOnce();
  });

  it("keeps rejecting invalid webhook secrets when enabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_WEBHOOK_ENABLED: true,
      ABACATEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      NODE_ENV: "production",
    });
    const request = new Request(
      "https://hub.example/api/webhooks/abacatepay?webhookSecret=wrong",
      {
        body: "{}",
        headers: {
          "x-webhook-signature": "invalid",
        },
        method: "POST",
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_secret",
    });
    expect(dependencies.processAbacatePayWebhook).not.toHaveBeenCalled();
  });

  it("keeps rejecting invalid webhook signatures when enabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ABACATEPAY_WEBHOOK_ENABLED: true,
      ABACATEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      NODE_ENV: "production",
    });
    const request = new Request(
      `https://hub.example/api/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`,
      {
        body: "{}",
        headers: {
          "x-webhook-signature": "invalid",
        },
        method: "POST",
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_signature",
    });
    expect(dependencies.processAbacatePayWebhook).not.toHaveBeenCalled();
  });
});
