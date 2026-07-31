import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  getAuth: vi.fn(),
  getApplicationUrl: vi.fn(),
  getServerEnv: vi.fn(),
  renderPendingCertificate: vi.fn(),
  sendAccessExpiryWarningEmail: vi.fn(),
  sendAccessReleasedEmail: vi.fn(),
  sendCertificateIssuedEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: dependencies.getApplicationUrl,
}));
vi.mock("@/features/certificates/server", () => ({
  renderPendingCertificate: dependencies.renderPendingCertificate,
}));
vi.mock("@/features/email/server", () => ({
  sendAccessExpiryWarningEmail: dependencies.sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail: dependencies.sendAccessReleasedEmail,
  sendCertificateIssuedEmail: dependencies.sendCertificateIssuedEmail,
  sendPasswordResetEmail: dependencies.sendPasswordResetEmail,
}));

import {
  ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER,
  deriveAccountActivationEmailIdempotencyKey,
} from "@/lib/account-activation-idempotency";
import { sendBetterAuthPasswordResetEmail } from "@/lib/auth-password-reset";
import { deliverOutboxMessage } from "./delivery";

const PAID_ASAAS_ORDER_PATTERN =
  /orders\.provider = 'asaas'[\s\S]*orders\.status = 'paid'/i;

interface PasswordResetApiInput {
  body: {
    email: string;
  };
  request?: Request;
}

const invokePasswordResetCallback = async ({
  body,
  request,
}: PasswordResetApiInput): Promise<{ status: true }> => {
  try {
    await sendBetterAuthPasswordResetEmail(
      {
        url: `https://auth.example.test/reset/${body.email}`,
        user: {
          email: body.email,
          name: "Student",
        },
      },
      request
    );
  } catch {
    // Better Auth logs and swallows callback failures before resolving its API.
  }
  return { status: true };
};

describe("outbox email delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.sendPasswordResetEmail.mockResolvedValue(undefined);
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
      BETTER_AUTH_URL: "https://auth.example.test",
    });
  });

  it("resolves the current account email when delivering an eligible activation", async () => {
    const requestPasswordReset = vi
      .fn()
      .mockImplementation(invokePasswordResetCallback);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          has_credential: false,
          student_email: "current@example.test",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });
    dependencies.getApplicationUrl.mockReturnValue(
      "https://hub.example.test/redefinir-senha"
    );
    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(PAID_ASAAS_ORDER_PATTERN),
      ["order-1", "user-1"]
    );
    expect(requestPasswordReset).toHaveBeenCalledWith({
      asResponse: false,
      body: {
        email: "current@example.test",
        redirectTo: "https://hub.example.test/redefinir-senha",
      },
      headers: {
        [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]:
          deriveAccountActivationEmailIdempotencyKey({
            authSecret: "auth-secret",
            outboxIdempotencyKey: "auth.account-activation/order-1/v1",
          }),
      },
      request: expect.any(Request),
    });
    const request: unknown = requestPasswordReset.mock.calls[0]?.[0]?.request;
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new Error("Expected a Better Auth request.");
    }
    expect(request.headers.get(ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER)).toBe(
      deriveAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        outboxIdempotencyKey: "auth.account-activation/order-1/v1",
      })
    );
    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: deriveAccountActivationEmailIdempotencyKey({
          authSecret: "auth-secret",
          outboxIdempotencyKey: "auth.account-activation/order-1/v1",
        }),
      })
    );
  });

  it("rejects an activation when the paid Asaas order does not match", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "wrong-user" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "aggregate_not_deliverable",
      retryable: false,
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("rejects malformed activation delivery data", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: "false",
            student_email: 123,
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "aggregate_not_deliverable",
      retryable: false,
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("delivers activation as a no-op when credentials already exist", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: true,
            student_email: "current@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(dependencies.sendAccessReleasedEmail).not.toHaveBeenCalled();
  });

  it("classifies Better Auth failures without exposing their cause", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            student_email: "private@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockRejectedValue(new Error("SMTP private@example.test failed")),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      message: "account_activation_failed",
      retryable: true,
    });
  });

  it("fails when Better Auth resolves after swallowing the email callback failure", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            student_email: "private@example.test",
          },
        ],
      }),
    });
    dependencies.sendPasswordResetEmail.mockRejectedValue(
      new Error(
        "Resend failed for private@example.test at https://auth.example.test/reset/private-token"
      )
    );
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockImplementation(invokePasswordResetCallback),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      message: "account_activation_failed",
      retryable: true,
    });
  });

  it("fails when Better Auth resolves without invoking the email callback", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            student_email: "missing@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi.fn().mockResolvedValue({ status: true }),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      retryable: true,
    });
  });

  it("isolates concurrent activation callback results", async () => {
    const successCallbackStarted = Promise.withResolvers<void>();
    const releaseSuccessCallback = Promise.withResolvers<void>();
    dependencies.getPool.mockReturnValue({
      query: vi
        .fn()
        .mockImplementation(
          async (_query: string, parameters: [string, string]) => ({
            rows: [
              {
                has_credential: false,
                student_email:
                  parameters[0] === "order-success"
                    ? "success@example.test"
                    : "failure@example.test",
              },
            ],
          })
        ),
    });
    dependencies.sendPasswordResetEmail.mockImplementation(
      async ({ to }: { to: string }) => {
        if (to === "success@example.test") {
          successCallbackStarted.resolve();
          await releaseSuccessCallback.promise;
          return;
        }
        await successCallbackStarted.promise;
        releaseSuccessCallback.resolve();
        throw new Error("provider unavailable");
      }
    );
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockImplementation(invokePasswordResetCallback),
      },
    });

    const results = await Promise.allSettled([
      deliverOutboxMessage({
        aggregateId: "order-success",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-success",
        idempotencyKey: "auth.account-activation/order-success/v1",
        payload: { orderId: "order-success", userId: "user-success" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      }),
      deliverOutboxMessage({
        aggregateId: "order-failure",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-failure",
        idempotencyKey: "auth.account-activation/order-failure/v1",
        payload: { orderId: "order-failure", userId: "user-failure" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      }),
    ]);

    expect(results[0]).toMatchObject({ status: "fulfilled" });
    expect(results[1]).toMatchObject({
      reason: expect.objectContaining({
        code: "account_activation_failed",
        retryable: true,
      }),
      status: "rejected",
    });
  });

  it("renders the immutable PDF before enqueueing the certificate email", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query,
        release: vi.fn(),
      }),
    });
    dependencies.renderPendingCertificate.mockResolvedValue(true);

    await deliverOutboxMessage({
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "certificate.render/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "certificate.render",
    });

    expect(dependencies.renderPendingCertificate).toHaveBeenCalledWith(
      "certificate-1"
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into outbox_messages"),
      expect.arrayContaining(["email.certificate-issued/certificate-1/v1"])
    );
  });

  it("does not enqueue a certificate email before the artifact is ready", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    });
    dependencies.renderPendingCertificate.mockResolvedValue(false);

    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "certificate.render/certificate-1/v1",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 1,
        topic: "certificate.render",
      })
    ).rejects.toMatchObject({ code: "aggregate_not_deliverable" });

    expect(query).not.toHaveBeenCalled();
  });

  it("classifies certificate rendering failures independently from email provider failures", async () => {
    dependencies.renderPendingCertificate.mockRejectedValue(
      new Error("certificate_background_unavailable")
    );

    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "certificate.render/certificate-1/v1",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 1,
        topic: "certificate.render",
      })
    ).rejects.toMatchObject({
      code: "certificate_render_failed",
      retryable: true,
    });
  });

  it("loads certificate recipient data at delivery time and passes its idempotency key", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          certificate_code: "PRT-001",
          course_title: "Curso de teste",
          student_email: "student@example.test",
          student_name: "Aluna Teste",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.sendCertificateIssuedEmail.mockResolvedValue(undefined);

    await deliverOutboxMessage({
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "email.certificate-issued",
    });

    expect(dependencies.sendCertificateIssuedEmail).toHaveBeenCalledWith({
      certificateCode: "PRT-001",
      courseTitle: "Curso de teste",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      to: "student@example.test",
      userName: "Aluna Teste",
    });
  });

  it("does not try delivery for an unsupported payload version", async () => {
    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "email.certificate-issued/certificate-1/v2",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 2,
        topic: "email.certificate-issued",
      })
    ).rejects.toMatchObject({
      code: "unknown_payload_version",
      retryable: false,
    });
  });
});
