import { afterEach, describe, expect, it, vi } from "vitest";

const { Resend, clientQuery, connect, poolQuery, release, send } = vi.hoisted(
  () => {
    const send = vi.fn();
    const poolQuery = vi.fn();
    const client = { query: vi.fn(), release: vi.fn() };
    const connect = vi.fn().mockResolvedValue(client);
    const Resend = vi.fn(function Resend() {
      return { emails: { send } };
    });

    return {
      connect,
      clientQuery: client.query,
      poolQuery,
      release: client.release,
      Resend,
      send,
    };
  }
);

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend }));
vi.mock("@/db", () => ({
  getPool: () => ({ connect, query: poolQuery }),
}));
vi.mock("@react-email/components", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@react-email/components")>();

  return {
    ...actual,
    render: vi.fn(actual.render),
  };
});

import { render as renderEmail } from "@react-email/components";
import { createEmailRequestFingerprint } from "@/features/email-delivery/server";
import { deriveAccountActivationEmailIdempotencyKey } from "@/lib/account-activation-idempotency";
import {
  getE2eCertificateEmailDeliveries,
  resetE2eCertificateEmailDeliveries,
} from "./e2e-delivery-sink";
import {
  sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail,
  sendCertificateIssuedEmail,
  sendCourseSalesOpenedEmail,
  sendHostedTemplateEmail,
  sendPasswordResetEmail,
  sendSupportRequestEmail,
  sendTransactionalEmail,
} from "./server";
import type { HostedEmailTemplateVariables } from "./templates-contract";

// Bun loads .env.local into process.env; strip the variables this suite owns
// so every test starts from the state it sets explicitly.
const ORIGINAL_ENV = (() => {
  const { SUPPORT_EMAIL: _ambientSupportEmail, ...snapshot } = process.env;
  return snapshot;
})();
const VALID_ACTIVATION_IDEMPOTENCY_KEY =
  deriveAccountActivationEmailIdempotencyKey({
    authSecret: "auth-secret",
    outboxIdempotencyKey: "auth.account-activation/order-1/v1",
  });
const TAMPERED_ACTIVATION_IDEMPOTENCY_KEY = `${VALID_ACTIVATION_IDEMPOTENCY_KEY.slice(
  0,
  -1
)}${VALID_ACTIVATION_IDEMPOTENCY_KEY.endsWith("0") ? "1" : "0"}`;
const STAGING_TEST_ENV: NodeJS.ProcessEnv = {
  APPLICATION_MAINTENANCE_MODE: "off",
  ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
  ASAAS_API_KEY: "$aact_hmlg_fixture",
  ASAAS_USER_AGENT: "hub/1.0 test@example.test",
  ASAAS_WEBHOOK_ENABLED: "true",
  ASAAS_WEBHOOK_TOKEN: "staging-webhook-token-fixture-000000000000",
  AUTH_PUBLIC_SIGNUP_ENABLED: "true",
  BETTER_AUTH_SECRET: "staging-auth-secret-fixture-000000000000",
  BETTER_AUTH_URL: "https://preview.neurocapacitar.com.br",
  CERTIFICATE_PUBLIC_BASE_URL: "https://preview.neurocapacitar.com.br",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  CRON_SECRET: "staging-cron-secret-fixture-000000000000",
  DATABASE_URL: "postgresql://fixture:fixture@ep-staging.example.test/neondb",
  HEALTHCHECK_SECRET: "staging-health-secret-fixture-000000000000",
  JMVSTREAM_AUTH_RESOURCE: "jmvstream-auth-resource-fixture",
  JMVSTREAM_PLAN_ID: "OD-20912",
  NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.test/4511999999999999",
  NODE_ENV: "test",
  PAYMENTS_CHECKOUT_MODE: "public",
  R2_ACCESS_KEY_ID: "r2-access-key-fixture",
  R2_ACCOUNT_ID: "r2-account-fixture",
  R2_BUCKET_NAME: "hub-development-private",
  R2_OBJECT_PREFIX: "staging",
  R2_PUBLIC_BASE_URL: "https://r2.example.test",
  R2_PUBLIC_BUCKET_NAME: "hub-development-public",
  R2_SECRET_ACCESS_KEY: "r2-secret-key-fixture",
  RESEND_API_KEY: "re_fixture",
  RESEND_FROM_EMAIL: "Staging <notificacoes@neurocapacitar.com.br>",
  RESEND_WEBHOOK_SECRET: "staging-resend-webhook-secret-fixture-000000000000",
  SCHEDULED_JOBS_ENABLED: "true",
  SENTRY_DSN: "https://secret@example.test/4511999999999999",
  STAGING_DATABASE_HOST: "ep-staging.example.test",
  STAGING_EMAIL_RECIPIENT_ALLOWLIST: "allowed@example.test",
  STAGING_JMVSTREAM_USES_PRODUCTION: "true",
  STAGING_R2_USES_DEVELOPMENT: "true",
  STAGING_RESEND_USES_PRODUCTION: "true",
  STAGING_SENTRY_PROJECT_ID: "4511999999999999",
  SUPPORT_EMAIL: "support@example.test",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "staging",
};

describe("transactional email", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    Resend.mockClear();
    vi.mocked(renderEmail).mockClear();
    send.mockReset();
    connect.mockClear();
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockClear();
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

  it("records lifecycle before IO and returns provider acceptance for outbox email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.com>";
    process.env.BETTER_AUTH_SECRET = "auth-secret-at-least-32-characters";
    const requestFingerprint = createEmailRequestFingerprint({
      authSecret: process.env.BETTER_AUTH_SECRET,
      request: {
        email: {
          from: "PROTEA-R <noreply@example.com>",
          tags: [
            { name: "hub_topic", value: "email_certificate_issued" },
            {
              name: "hub_correlation",
              value: "0198d6f4-c2a5-7000-8000-000000000001",
            },
          ],
          template: {
            id: "certificate-issued",
            variables: {
              ACTION_URL: "https://app.example.test/certificate",
              CERTIFICATE_CODE: "CERT-1",
              COURSE_TITLE: "Course",
              USER_NAME: "Student",
            },
          },
          to: "student@example.com",
        },
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
      },
    });
    clientQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            accepted_at: null,
            automatic_retry_deadline_at: null,
            database_now: new Date("2026-08-24T12:00:00.000Z"),
            first_provider_attempt_at: null,
            id: "0198d6f4-c2a5-7000-8000-000000000001",
            provider_message_id: null,
            request_fingerprint: requestFingerprint,
            status: "sending",
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const acceptedAt = new Date("2026-08-24T12:00:01.000Z");
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ accepted_at: acceptedAt }],
    });
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await expect(
      sendHostedTemplateEmail({
        ACTION_URL: "https://app.example.test/certificate",
        CERTIFICATE_CODE: "CERT-1",
        COURSE_TITLE: "Course",
        deliveryContext: {
          correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
          idempotencyKey: "email.certificate-issued/certificate-1/v1",
          outboxMessageId: "0198d6f4-c2a5-7000-8000-000000000001",
          topic: "email.certificate-issued",
        },
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        name: "certificate-issued",
        to: "student@example.com",
        USER_NAME: "Student",
      })
    ).resolves.toEqual({
      acceptedAt,
      messageId: "email_123",
      provider: "resend",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [
          { name: "hub_topic", value: "email_certificate_issued" },
          {
            name: "hub_correlation",
            value: "0198d6f4-c2a5-7000-8000-000000000001",
          },
        ],
      }),
      { idempotencyKey: "email.certificate-issued/certificate-1/v1" }
    );
    expect(clientQuery.mock.calls[0]?.[0]).toBe("begin");
    expect(clientQuery.mock.calls.at(-1)?.[0]).toBe("commit");
    expect(release).toHaveBeenCalledOnce();
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

  it("sends the hosted access-released template with both action URLs", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example.test";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendAccessReleasedEmail({
      courseId: "course-1",
      courseTitle: "Curso de teste",
      idempotencyKey: "email.access-released/course-1/v1",
      to: "student@example.test",
      userName: "Aluno de teste",
    });

    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "support@example.test",
      subject: "Acesso liberado no PROTEA-R Hub",
      template: {
        id: "access-released",
        variables: {
          ACTION_URL: "https://hub.example.test/app/cursos/course-1",
          COURSE_TITLE: "Curso de teste",
          PASSWORD_RESET_URL: "https://hub.example.test/recuperar-senha",
          USER_NAME: "Aluno de teste",
        },
      },
      to: "student@example.test",
    });
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(send).toHaveBeenCalledTimes(1);
    expect(options).toEqual({
      idempotencyKey: "email.access-released/course-1/v1",
    });
  });

  it("sends access-released to the app root when course is absent", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example.test";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendAccessReleasedEmail({
      courseTitle: "Curso geral",
      to: "student@example.test",
      userName: "Aluna de teste",
    });

    const [email] = send.mock.calls[0] ?? [];
    expect(email).toEqual({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "support@example.test",
      subject: "Acesso liberado no PROTEA-R Hub",
      template: {
        id: "access-released",
        variables: {
          ACTION_URL: "https://hub.example.test/app",
          COURSE_TITLE: "Curso geral",
          PASSWORD_RESET_URL: "https://hub.example.test/recuperar-senha",
          USER_NAME: "Aluna de teste",
        },
      },
      to: "student@example.test",
    });
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      daysRemaining: 1,
      expectedDaysRemaining: "1 dia",
      expectedSubject: "Seu acesso vence em 1 dia",
      idempotencyKey: "email.access-expiry-warning/course-1-day/v1",
    },
    {
      daysRemaining: 7,
      expectedDaysRemaining: "7 dias",
      expectedSubject: "Seu acesso vence em 7 dias",
      idempotencyKey: "email.access-expiry-warning/course-7-days/v1",
    },
  ])("sends the hosted expiry-warning template for $daysRemaining days", async ({
    daysRemaining,
    expectedDaysRemaining,
    expectedSubject,
    idempotencyKey,
  }) => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendAccessExpiryWarningEmail({
      courseId: "course-expiry",
      courseTitle: "Curso de expiração",
      daysRemaining,
      idempotencyKey,
      to: "student@example.test",
      userName: "Aluna de teste",
    });

    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual({
      from: "PROTEA-R <noreply@example.test>",
      subject: expectedSubject,
      template: {
        id: "access-expiry-warning",
        variables: {
          ACTION_URL: "https://hub.example.test/app/cursos/course-expiry",
          COURSE_TITLE: "Curso de expiração",
          DAYS_REMAINING: expectedDaysRemaining,
          USER_NAME: "Aluna de teste",
        },
      },
      to: "student@example.test",
    });
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(send).toHaveBeenCalledTimes(1);
    expect(options).toEqual({ idempotencyKey });
  });

  it("sends the support request with the hosted template", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendSupportRequestEmail({
      courseTitle: "Curso de suporte",
      message: "Mensagem de teste controlada.",
      studentEmail: "student@example.test",
      studentName: "Aluna de suporte",
      subject: "Dúvida controlada",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [email] = send.mock.calls[0] ?? [];
    expect(email).toEqual({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "student@example.test",
      subject: "Suporte: Dúvida controlada",
      template: {
        id: "support-request",
        variables: {
          COURSE_TITLE: "Curso de suporte",
          MESSAGE: "Mensagem de teste controlada.",
          STUDENT_EMAIL: "student@example.test",
          STUDENT_NAME: "Aluna de suporte",
          SUPPORT_SUBJECT: "Dúvida controlada",
        },
      },
      to: "support@example.test",
    });
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
  });

  it("uses the hosted fallback when the support request has no course", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendSupportRequestEmail({
      message: "Mensagem sem curso.",
      studentEmail: "student@example.test",
      studentName: "Aluna sem curso",
      subject: "Dúvida geral",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [email] = send.mock.calls[0] ?? [];
    expect(email).toEqual({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "student@example.test",
      subject: "Suporte: Dúvida geral",
      template: {
        id: "support-request",
        variables: {
          COURSE_TITLE: "Não informado",
          MESSAGE: "Mensagem sem curso.",
          STUDENT_EMAIL: "student@example.test",
          STUDENT_NAME: "Aluna sem curso",
          SUPPORT_SUBJECT: "Dúvida geral",
        },
      },
      to: "support@example.test",
    });
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
  });

  it("sends the auth hosted template with only template variables and envelope fields", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const variables = {
      ACTION_URL: "https://hub.example.test/recuperar-senha/token",
      name: "auth-password-reset",
      USER_NAME: "Aluna de teste",
    } satisfies HostedEmailTemplateVariables;

    await sendHostedTemplateEmail({
      ...variables,
      idempotencyKey: "email.auth-password-reset/account-1/v1",
      replyTo: "reply@example.test",
      subject: "Criar ou redefinir senha",
      to: "student@example.test",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(renderEmail).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      {
        from: "PROTEA-R <noreply@example.test>",
        replyTo: "reply@example.test",
        subject: "Criar ou redefinir senha",
        template: {
          id: "auth-password-reset",
          variables: {
            ACTION_URL: "https://hub.example.test/recuperar-senha/token",
            USER_NAME: "Aluna de teste",
          },
        },
        to: "student@example.test",
      },
      { idempotencyKey: "email.auth-password-reset/account-1/v1" }
    );

    const [payload] = send.mock.calls[0] ?? [];
    expect(payload).not.toHaveProperty("html");
    expect(payload).not.toHaveProperty("text");
    expect(payload).not.toHaveProperty("react");
    expect(payload.template.variables).not.toHaveProperty("name");
    expect(payload.template.variables).not.toHaveProperty("to");
    expect(payload.template.variables).not.toHaveProperty("subject");
    expect(payload.template.variables).not.toHaveProperty("replyTo");
  });

  it("sends access-released hosted variables with both action URLs", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendHostedTemplateEmail({
      ACTION_URL: "https://hub.example.test/app/cursos/course-1",
      COURSE_TITLE: "Curso de teste",
      name: "access-released",
      PASSWORD_RESET_URL: "https://hub.example.test/recuperar-senha",
      to: "student@example.test",
      USER_NAME: "Aluna de teste",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "support@example.test",
      template: {
        id: "access-released",
        variables: {
          ACTION_URL: "https://hub.example.test/app/cursos/course-1",
          COURSE_TITLE: "Curso de teste",
          PASSWORD_RESET_URL: "https://hub.example.test/recuperar-senha",
          USER_NAME: "Aluna de teste",
        },
      },
      to: "student@example.test",
    });
  });

  it("sends access-expiry-warning with DAYS_REMAINING as a string", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendHostedTemplateEmail({
      ACTION_URL: "https://hub.example.test/app/cursos/course-1",
      COURSE_TITLE: "Curso de expiração",
      DAYS_REMAINING: "7 dias",
      name: "access-expiry-warning",
      to: "student@example.test",
      USER_NAME: "Aluna de teste",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      from: "PROTEA-R <noreply@example.test>",
      template: {
        id: "access-expiry-warning",
        variables: {
          ACTION_URL: "https://hub.example.test/app/cursos/course-1",
          COURSE_TITLE: "Curso de expiração",
          DAYS_REMAINING: "7 dias",
          USER_NAME: "Aluna de teste",
        },
      },
      to: "student@example.test",
    });
  });

  it("uses an explicit reply-to for the support hosted template", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "support@example.test";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendHostedTemplateEmail({
      COURSE_TITLE: "Curso de suporte",
      MESSAGE: "Mensagem de teste controlada.",
      name: "support-request",
      replyTo: "student@example.test",
      STUDENT_EMAIL: "student@example.test",
      STUDENT_NAME: "Aluna de suporte",
      subject: "Dúvida controlada",
      SUPPORT_SUBJECT: "Dúvida controlada",
      to: "support@example.test",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      from: "PROTEA-R <noreply@example.test>",
      replyTo: "student@example.test",
      subject: "Dúvida controlada",
      template: {
        id: "support-request",
        variables: {
          COURSE_TITLE: "Curso de suporte",
          MESSAGE: "Mensagem de teste controlada.",
          STUDENT_EMAIL: "student@example.test",
          STUDENT_NAME: "Aluna de suporte",
          SUPPORT_SUBJECT: "Dúvida controlada",
        },
      },
      to: "support@example.test",
    });
  });

  it("treats a valid activation HMAC conflict as an already accepted hosted email", async () => {
    process.env.BETTER_AUTH_SECRET = "auth-secret";
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });

    await expect(
      sendHostedTemplateEmail({
        ACTION_URL: "https://auth.example.test/reset/new-token",
        idempotencyKey: VALID_ACTIVATION_IDEMPOTENCY_KEY,
        name: "auth-password-reset",
        to: "student@example.test",
        USER_NAME: "Student",
      })
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("records a lifecycle activation conflict as terminal without contacting Resend again", async () => {
    process.env.BETTER_AUTH_SECRET = "auth-secret";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.com>";
    const correlationId = "0198d6f4-c2a5-7000-8000-000000000001";
    const acceptedAt = new Date("2026-08-24T12:00:01.000Z");
    let requestFingerprint = "";
    let selectedRows = 0;
    const pendingRow = {
      accepted_at: null,
      automatic_retry_deadline_at: null,
      database_now: new Date("2026-08-24T12:00:00.000Z"),
      first_provider_attempt_at: null,
      id: correlationId,
      provider_message_id: null,
      request_fingerprint: requestFingerprint,
      status: "sending",
    };
    const satisfiedRow = {
      ...pendingRow,
      accepted_at: acceptedAt,
      automatic_retry_deadline_at: new Date("2026-08-25T11:00:00.000Z"),
      first_provider_attempt_at: new Date("2026-08-24T12:00:00.000Z"),
      status: "accepted",
    };
    clientQuery.mockImplementation((query: string, parameters?: unknown[]) => {
      if (query.includes("insert into email_messages")) {
        requestFingerprint = String(parameters?.[4] ?? "");
      }
      if (query.includes("from email_messages")) {
        selectedRows += 1;
        const row = selectedRows === 1 ? pendingRow : satisfiedRow;
        return {
          rows: [{ ...row, request_fingerprint: requestFingerprint }],
        } as never;
      }
      return { rows: [] } as never;
    });
    poolQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ accepted_at: acceptedAt }],
    });
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });
    const input = {
      deliveryContext: {
        correlationId,
        idempotencyKey: "auth.account-activation/order-1/v1",
        outboxMessageId: correlationId,
        topic: "auth.account-activation" as const,
      },
      idempotencyKey: VALID_ACTIVATION_IDEMPOTENCY_KEY,
      resetUrl: "https://auth.example.test/reset/new-token",
      to: "student@example.com",
      userName: "Student",
    };

    await expect(sendPasswordResetEmail(input)).resolves.toBeUndefined();
    await expect(sendPasswordResetEmail(input)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: VALID_ACTIVATION_IDEMPOTENCY_KEY,
    });
    expect(String(poolQuery.mock.calls[0]?.[0])).toContain(
      "status = 'accepted'"
    );
  });

  it("rejects an idempotency conflict for a non-activation hosted email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Idempotency key reused with a different payload",
        name: "invalid_idempotent_request",
      },
    });

    await expect(
      sendHostedTemplateEmail({
        ACTION_URL: "https://hub.example.test/app/cursos/course-1",
        COURSE_TITLE: "Curso de teste",
        idempotencyKey: "email.access-released/course-1/v1",
        name: "access-released",
        PASSWORD_RESET_URL: "https://hub.example.test/recuperar-senha",
        to: "student@example.test",
        USER_NAME: "Aluna de teste",
      })
    ).rejects.toThrow("Idempotency key reused with a different payload");

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not contact Resend for a hosted email in isolated E2E mode", async () => {
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3100";
    process.env.CERTIFICATE_PUBLIC_BASE_URL = "http://127.0.0.1:3100";
    process.env.CI = "true";
    process.env.E2E_TEST_MODE = "true";
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3100";
    process.env.RESEND_API_KEY = "re_must_not_be_used";

    await expect(
      sendHostedTemplateEmail({
        ACTION_URL: "http://127.0.0.1:3100/recuperar-senha/token",
        name: "auth-password-reset",
        to: "student@example.test",
        USER_NAME: "Student",
      })
    ).resolves.toBeUndefined();

    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("blocks a hosted email outside the Staging recipient allowlist", async () => {
    process.env = { ...STAGING_TEST_ENV };

    await expect(
      sendHostedTemplateEmail({
        ACTION_URL: "https://preview.neurocapacitar.com.br/app/cursos/course-1",
        COURSE_TITLE: "Curso de teste",
        name: "access-released",
        PASSWORD_RESET_URL:
          "https://preview.neurocapacitar.com.br/recuperar-senha",
        to: "blocked@example.test",
        USER_NAME: "Aluna de teste",
      })
    ).rejects.toThrow("Email recipient is not allowlisted for Staging.");

    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
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

  it("sends the password reset hosted template with the activation idempotency key", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.SUPPORT_EMAIL = "";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendPasswordResetEmail({
      idempotencyKey:
        "auth-account-activation-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.com",
      userName: "Student",
    });

    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual(
      expect.objectContaining({
        subject: "Criar ou redefinir senha do PROTEA-R Hub",
        template: {
          id: "auth-password-reset",
          variables: {
            ACTION_URL: "https://auth.example.test/reset/token",
            USER_NAME: "Student",
          },
        },
        to: "student@example.com",
      })
    );
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(email.template.variables).not.toHaveProperty("PASSWORD_RESET_URL");
    expect(options).toEqual({
      idempotencyKey:
        "auth-account-activation-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(renderEmail).not.toHaveBeenCalled();
  });

  it("sends the hosted course sales-opened template with the stable purchase link", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PROTEA-R <noreply@example.test>";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendCourseSalesOpenedEmail({
      courseSlug: "curso público/1",
      courseTitle: "Curso público",
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
      to: "student@example.com",
      userName: "Student",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual(
      expect.objectContaining({
        subject: "Inscrições abertas: Curso público",
        template: {
          id: "course-sales-opened",
          variables: {
            ACTION_URL: "https://hub.example/comprar/curso%20p%C3%BAblico%2F1",
            COURSE_TITLE: "Curso público",
            USER_NAME: "Student",
          },
        },
        to: "student@example.com",
      })
    );
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(options).toEqual({
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
    });
  });

  it("sends the certificate-issued hosted template with the public validation link", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.CERTIFICATE_PUBLIC_BASE_URL = "https://certificates.example/";
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example";
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendCertificateIssuedEmail({
      certificateCode: "CERT/001 2026",
      courseTitle: "Curso de teste",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      to: "student@example.com",
      userName: "Student",
    });

    const [email, options] = send.mock.calls[0] ?? [];
    expect(email).toEqual(
      expect.objectContaining({
        subject: "Seu certificado PROTEA-R Hub foi emitido",
        template: {
          id: "certificate-issued",
          variables: {
            ACTION_URL:
              "https://certificates.example/certificados/CERT%2F001%202026",
            CERTIFICATE_CODE: "CERT/001 2026",
            COURSE_TITLE: "Curso de teste",
            USER_NAME: "Student",
          },
        },
        to: "student@example.com",
      })
    );
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("text");
    expect(email).not.toHaveProperty("react");
    expect(options).toEqual({
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
    });
    expect(Resend).toHaveBeenCalledWith("re_test");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("records a minimized certificate delivery without contacting Resend in strict E2E mode", async () => {
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3100";
    process.env.CERTIFICATE_PUBLIC_BASE_URL = "http://127.0.0.1:3100";
    process.env.CI = "true";
    process.env.E2E_TEST_MODE = "true";
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3100";
    process.env.RESEND_API_KEY = "re_must_not_be_used";
    resetE2eCertificateEmailDeliveries();

    await sendCertificateIssuedEmail({
      certificateCode: "CERT-001",
      courseTitle: "Curso secreto que nao deve ser armazenado",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      to: "student@example.com",
      userName: "Nome secreto que nao deve ser armazenado",
    });

    expect(getE2eCertificateEmailDeliveries()).toEqual([
      {
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        recipientKey:
          "sha256:616bb35d31d0a6840d2d5adfeacde5979ea99a18ab5fa7bb633460029e20717e",
        topic: "email.certificate-issued",
      },
    ]);
    expect(JSON.stringify(getE2eCertificateEmailDeliveries())).not.toContain(
      "CERT-001"
    );
    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    resetE2eCertificateEmailDeliveries();
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

  it("does not render or contact Resend for a recipient outside the Staging allowlist", async () => {
    process.env = { ...STAGING_TEST_ENV };
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await expect(
      sendTransactionalEmail({
        react: "Conteudo que nao deve ser renderizado",
        subject: "Acesso liberado",
        to: "blocked@example.test",
      })
    ).rejects.toThrow("Email recipient is not allowlisted for Staging.");

    expect(Resend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(renderEmail).not.toHaveBeenCalled();
  });

  it("contacts Resend for an allowlisted Staging recipient", async () => {
    process.env = { ...STAGING_TEST_ENV };
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendTransactionalEmail({
      react: "Conteudo permitido",
      subject: "Acesso liberado",
      to: "allowed@example.test",
    });

    expect(Resend).toHaveBeenCalledWith("re_fixture");
    expect(renderEmail).toHaveBeenCalledWith("Conteudo permitido");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "allowed@example.test",
      })
    );
  });
});
