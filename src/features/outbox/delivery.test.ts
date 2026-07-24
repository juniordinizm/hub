import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  renderPendingCertificate: vi.fn(),
  sendAccessExpiryWarningEmail: vi.fn(),
  sendAccessReleasedEmail: vi.fn(),
  sendCertificateIssuedEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/certificates/server", () => ({
  renderPendingCertificate: dependencies.renderPendingCertificate,
}));
vi.mock("@/features/email/server", () => ({
  sendAccessExpiryWarningEmail: dependencies.sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail: dependencies.sendAccessReleasedEmail,
  sendCertificateIssuedEmail: dependencies.sendCertificateIssuedEmail,
}));

import { deliverOutboxMessage } from "./delivery";

describe("outbox email delivery", () => {
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
