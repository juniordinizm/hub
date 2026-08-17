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

import { deriveAccountActivationEmailIdempotencyKey } from "@/lib/account-activation-idempotency";
import {
  sendCourseSalesOpenedEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
} from "./server";

const ORIGINAL_ENV = { ...process.env };
const VALID_ACTIVATION_IDEMPOTENCY_KEY =
  deriveAccountActivationEmailIdempotencyKey({
    authSecret: "auth-secret",
    outboxIdempotencyKey: "auth.account-activation/order-1/v1",
  });
const TAMPERED_ACTIVATION_IDEMPOTENCY_KEY = `${VALID_ACTIVATION_IDEMPOTENCY_KEY.slice(
  0,
  -1
)}${VALID_ACTIVATION_IDEMPOTENCY_KEY.endsWith("0") ? "1" : "0"}`;

describe("transactional email", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    Resend.mockClear();
    send.mockReset();
  });

  it("renders email content through Resend with reply-to", async () => {
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
      html: expect.stringContaining("Conteúdo do e-mail"),
      replyTo: "student@example.com",
      subject: "Suporte",
      to: "support@example.com",
    });
  });

  it("escapes string content before sending it as HTML", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendTransactionalEmail({
      react: "<b>unsafe content</b>",
      subject: "Acesso liberado",
      to: "student@example.com",
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("&lt;b&gt;unsafe content&lt;/b&gt;"),
      })
    );
  });

  it("uses the monitored support inbox as the default reply-to", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL =
      "Neuro Capacitar <notificacoes@neurocapacitar.com.br>";
    process.env.SUPPORT_EMAIL = "suporte@neurocapacitar.com.br";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendTransactionalEmail({
      react: "Conteúdo do e-mail",
      subject: "Acesso liberado",
      to: "student@example.com",
    });

    expect(send).toHaveBeenCalledWith({
      from: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
      html: expect.stringContaining("Conteúdo do e-mail"),
      replyTo: "suporte@neurocapacitar.com.br",
      subject: "Acesso liberado",
      to: "student@example.com",
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

  it("forwards an outbox idempotency key to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendTransactionalEmail({
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      react: "Conteúdo do e-mail",
      subject: "Certificado",
      to: "student@example.com",
    });

    expect(send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
    });
  });

  it("forwards an activation idempotency key from password reset email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendPasswordResetEmail({
      idempotencyKey:
        "auth-account-activation-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.com",
      userName: "Student",
    });

    expect(send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey:
        "auth-account-activation-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("renders the reset link and user name in the password reset email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendPasswordResetEmail({
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.com",
      userName: "Student",
    });

    const [email] = send.mock.calls[0] ?? [];
    expect(email).toEqual(
      expect.objectContaining({
        html: expect.stringContaining("https://auth.example.test/reset/token"),
      })
    );
    expect(email.html).toContain("Student");
    expect(email).not.toHaveProperty("react");
  });

  it("sends the fixed course sales-opened template with the stable purchase link", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendCourseSalesOpenedEmail({
      courseSlug: "curso-publico",
      courseTitle: "Curso público",
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
      to: "student@example.com",
      userName: "Student",
    });

    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual(
      expect.objectContaining({
        html: expect.stringContaining(
          "https://hub.example/comprar/curso-publico"
        ),
        subject: "Inscrições abertas: Curso público",
        to: "student@example.com",
      })
    );
    expect(email.html).toContain("Student");
    expect(options).toEqual({
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
    });
  });

  it("treats an activation payload conflict as an already accepted email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.BETTER_AUTH_SECRET = "auth-secret";
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });

    await expect(
      sendPasswordResetEmail({
        idempotencyKey: VALID_ACTIVATION_IDEMPOTENCY_KEY,
        resetUrl: "https://auth.example.test/reset/new-token",
        to: "student@example.com",
        userName: "Student",
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    `auth-account-activation-v1-${"a".repeat(64)}-${"b".repeat(64)}`,
    TAMPERED_ACTIVATION_IDEMPOTENCY_KEY,
  ])("rejects an unauthenticated activation idempotency conflict", async (idempotencyKey) => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.BETTER_AUTH_SECRET = "auth-secret";
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });

    await expect(
      sendPasswordResetEmail({
        idempotencyKey,
        resetUrl: "https://auth.example.test/reset/new-token",
        to: "student@example.com",
        userName: "Student",
      })
    ).rejects.toThrow("Idempotency key reused with a different payload");
  });

  it("does not suppress an idempotency conflict for another email topic", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });

    await expect(
      sendTransactionalEmail({
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        react: "Certificate",
        subject: "Certificate",
        to: "student@example.com",
      })
    ).rejects.toThrow("Idempotency key reused with a different payload");
  });

  it("does not contact Resend in isolated E2E mode", async () => {
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3100";
    process.env.CERTIFICATE_PUBLIC_BASE_URL = "http://127.0.0.1:3100";
    process.env.CI = "true";
    process.env.E2E_TEST_MODE = "true";
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3100";
    process.env.RESEND_API_KEY = "";

    await expect(
      sendTransactionalEmail({
        react: "Conteudo do e-mail",
        subject: "Recuperacao de senha",
        to: "student@example.com",
      })
    ).resolves.toBeUndefined();

    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("does not contact Resend for a recipient outside the Development allowlist", async () => {
    process.env = {
      ...process.env,
      DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST: "dev@example.com",
      NODE_ENV: "development",
      RESEND_API_KEY: "re_development",
    };

    await expect(
      sendTransactionalEmail({
        react: "Conteudo do e-mail",
        subject: "Acesso liberado",
        to: "external@example.com",
      })
    ).rejects.toThrow("Email recipient is not allowlisted for Development.");

    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
