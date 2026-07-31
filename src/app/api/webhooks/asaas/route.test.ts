import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  persistAsaasWebhook: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/features/payments/asaas-webhook-inbox", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/payments/asaas-webhook-inbox")
  >("@/features/payments/asaas-webhook-inbox");
  return {
    ...actual,
    persistAsaasWebhook: dependencies.persistAsaasWebhook,
  };
});

import { AsaasWebhookInputError } from "@/features/payments/asaas-webhook-inbox";
import { POST } from "./route";

const TOKEN = "asaas-webhook-token-at-least-thirty-two-characters";
const validBody = JSON.stringify({
  event: "FUTURE_EVENT",
  id: "evt_future",
});

const request = ({
  body = validBody,
  token = TOKEN,
}: {
  body?: string;
  token?: string | null;
} = {}): Request =>
  new Request("https://hub.example/api/webhooks/asaas", {
    body,
    headers: token ? { "asaas-access-token": token } : {},
    method: "POST",
  });

describe("POST /api/webhooks/asaas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_WEBHOOK_ENABLED: true,
      ASAAS_WEBHOOK_TOKEN: TOKEN,
    });
    dependencies.persistAsaasWebhook.mockResolvedValue({
      duplicate: false,
      id: "inbox-1",
    });
  });

  it("rejects before token, body and persistence when disabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_WEBHOOK_ENABLED: false,
      ASAAS_WEBHOOK_TOKEN: TOKEN,
    });

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "service_unavailable",
    });
    expect(dependencies.persistAsaasWebhook).not.toHaveBeenCalled();
  });

  it.each([
    ["absent", null],
    ["invalid", "wrong-token-with-at-least-thirty-two-characters"],
  ])("rejects an %s token before reading or persisting", async (_case, token) => {
    const response = await POST(request({ token }));

    expect(response.status).toBe(401);
    expect(dependencies.persistAsaasWebhook).not.toHaveBeenCalled();
  });

  it("fails safely when the expected token is absent or weak", async () => {
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_WEBHOOK_TOKEN: "weak",
    });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(dependencies.persistAsaasWebhook).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before JSON parsing or persistence", async () => {
    const response = await POST(request({ body: "x".repeat(262_145) }));

    expect(response.status).toBe(413);
    expect(dependencies.persistAsaasWebhook).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and structurally invalid events", async () => {
    const malformed = await POST(request({ body: "{" }));
    expect(malformed.status).toBe(400);

    dependencies.persistAsaasWebhook.mockRejectedValueOnce(
      new AsaasWebhookInputError()
    );
    const structurallyInvalid = await POST(request());
    expect(structurallyInvalid.status).toBe(400);
  });

  it.each([
    [{ duplicate: false, id: "inbox-1" }, "new"],
    [{ duplicate: true, id: null }, "duplicate"],
  ])("returns exactly 200 only after persisting a %s event", async (result, _case) => {
    dependencies.persistAsaasWebhook.mockResolvedValueOnce(result);

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dependencies.persistAsaasWebhook).toHaveBeenCalledWith({
      payload: JSON.parse(validBody),
    });
  });

  it("does not return success when persistence fails", async () => {
    dependencies.persistAsaasWebhook.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    const response = await POST(request());

    expect(response.status).toBe(503);
  });
});
