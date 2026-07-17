import { afterEach, describe, expect, it, vi } from "vitest";

const { Resend, send } = vi.hoisted(() => {
  const send = vi.fn();
  const Resend = vi.fn(function Resend() {
    return { emails: { send } };
  });

  return {
    Resend,
    send,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend }));

import { sendTransactionalEmail } from "./server";

const ORIGINAL_ENV = { ...process.env };

describe("transactional email", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    Resend.mockClear();
    send.mockReset();
  });

  it("sends React email through Resend with reply-to", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.com>";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendTransactionalEmail({
      react: "Conteúdo do e-mail",
      replyTo: "student@example.com",
      subject: "Suporte",
      to: "support@example.com",
    });

    expect(Resend).toHaveBeenCalledWith("re_test");
    expect(send).toHaveBeenCalledWith({
      from: "PROTEA-R <noreply@example.com>",
      react: "Conteúdo do e-mail",
      replyTo: "student@example.com",
      subject: "Suporte",
      to: "support@example.com",
    });
  });

  it("fails with the provider error instead of reporting a sent message", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({
      data: null,
      error: { message: "Sender domain is not verified" },
    });

    await expect(
      sendTransactionalEmail({
        react: "Conteúdo do e-mail",
        subject: "Acesso liberado",
        to: "student@example.com",
      })
    ).rejects.toThrow("Sender domain is not verified");
  });
});
