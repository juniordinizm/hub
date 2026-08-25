import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  getServerEnv: vi.fn(),
  persistResendWebhookEvent: vi.fn(),
  release: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect }),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return { webhooks: { verify: dependencies.verify } };
  }),
}));
vi.mock("@/features/email-delivery/resend-webhook", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/email-delivery/resend-webhook")
  >("@/features/email-delivery/resend-webhook");
  return {
    ...actual,
    persistResendWebhookEvent: dependencies.persistResendWebhookEvent,
  };
});

import { POST } from "./route";

const rawBody = JSON.stringify({
  created_at: "2026-08-24T12:00:00.000Z",
  data: { email_id: "resend-message-1" },
  type: "email.delivered",
});

const request = ({ headers = true }: { headers?: boolean } = {}): Request =>
  new Request("https://app.example.test/api/webhooks/resend", {
    body: rawBody,
    headers: headers
      ? {
          "svix-id": "svix-event-1",
          "svix-signature": "v1,signature",
          "svix-timestamp": "1787572800",
        }
      : {},
    method: "POST",
  });

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      RESEND_API_KEY: "re_test",
      RESEND_WEBHOOK_SECRET: "whsec_secret-at-least-32-characters",
    });
    dependencies.verify.mockReturnValue(JSON.parse(rawBody));
    dependencies.persistResendWebhookEvent.mockResolvedValue({
      id: "local-event-1",
      inserted: true,
    });
    dependencies.connect.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: dependencies.release,
    });
  });

  it("rejects missing headers before body verification or persistence", async () => {
    const response = await POST(request({ headers: false }));
    expect(response.status).toBe(400);
    expect(dependencies.verify).not.toHaveBeenCalled();
    expect(dependencies.connect).not.toHaveBeenCalled();
  });

  it("reads raw body once and passes only the exact Svix shape to the SDK", async () => {
    const input = request();
    const text = vi.spyOn(input, "text");
    const response = await POST(input);

    expect(response.status).toBe(200);
    expect(text).toHaveBeenCalledOnce();
    expect(dependencies.verify).toHaveBeenCalledWith({
      headers: {
        id: "svix-event-1",
        signature: "v1,signature",
        timestamp: "1787572800",
      },
      payload: rawBody,
      webhookSecret: "whsec_secret-at-least-32-characters",
    });
    expect(dependencies.persistResendWebhookEvent).toHaveBeenCalledWith({
      client: expect.any(Object),
      event: expect.objectContaining({
        eventType: "email.delivered",
        providerEventId: "svix-event-1",
        providerMessageId: "resend-message-1",
      }),
    });
  });

  it("returns 400 with zero writes for an invalid signature", async () => {
    dependencies.verify.mockImplementation(() => {
      throw new Error("signature included private content");
    });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(dependencies.connect).not.toHaveBeenCalled();
    expect(dependencies.persistResendWebhookEvent).not.toHaveBeenCalled();
  });

  it("returns 200 for a signed invalid schema and for a duplicate after commit", async () => {
    dependencies.verify.mockReturnValueOnce({ type: "email.delivered" });
    dependencies.persistResendWebhookEvent.mockResolvedValueOnce({
      id: null,
      inserted: false,
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(dependencies.persistResendWebhookEvent).toHaveBeenCalledWith({
      client: expect.any(Object),
      event: expect.objectContaining({
        lastErrorCode: "invalid_event_schema",
        status: "dead_letter",
      }),
    });
  });

  it("returns 503 and rolls back when persistence fails", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: dependencies.release,
    };
    dependencies.connect.mockResolvedValue(client);
    dependencies.persistResendWebhookEvent.mockRejectedValue(
      new Error("database unavailable")
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(dependencies.release).toHaveBeenCalledOnce();
  });

  it("returns 503 when a database connection cannot be acquired", async () => {
    dependencies.connect.mockRejectedValue(new Error("pool unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(dependencies.persistResendWebhookEvent).not.toHaveBeenCalled();
  });
});
