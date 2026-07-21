import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  sendAccessExpiryWarningEmail: vi.fn(),
  sendAccessReleasedEmail: vi.fn(),
  sendCertificateIssuedEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/email/server", () => ({
  sendAccessExpiryWarningEmail: dependencies.sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail: dependencies.sendAccessReleasedEmail,
  sendCertificateIssuedEmail: dependencies.sendCertificateIssuedEmail,
}));

import { deliverOutboxMessage } from "./delivery";

describe("outbox email delivery", () => {
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
