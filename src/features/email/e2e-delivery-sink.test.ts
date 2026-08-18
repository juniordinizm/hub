import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getE2eCertificateEmailDeliveries,
  recordE2eCertificateEmailDelivery,
  resetE2eCertificateEmailDeliveries,
} from "./e2e-delivery-sink";

const ORIGINAL_ENV = { ...process.env };

const setStrictE2eEnvironment = (): void => {
  process.env.CI = "true";
  process.env.E2E_TEST_MODE = "true";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3100";
  process.env.CERTIFICATE_PUBLIC_BASE_URL = "http://127.0.0.1:3100";
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3100";
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_TARGET_ENV;
};

describe("E2E certificate email delivery sink", () => {
  afterEach(() => {
    setStrictE2eEnvironment();
    resetE2eCertificateEmailDeliveries();
    process.env = { ...ORIGINAL_ENV };
  });

  it.each([
    ["CI", "false"],
    ["E2E_TEST_MODE", "false"],
    ["BETTER_AUTH_URL", "http://localhost:3100"],
    ["NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3200"],
    ["CERTIFICATE_PUBLIC_BASE_URL", "https://app.example.com"],
    ["VERCEL_ENV", "production"],
    ["VERCEL_ENV", "preview"],
    ["VERCEL_TARGET_ENV", "staging"],
  ])("fails closed when %s is outside the strict E2E contract", (key, value) => {
    setStrictE2eEnvironment();
    process.env[key] = value;

    expect(() =>
      recordE2eCertificateEmailDelivery({
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        recipient: "student@example.com",
      })
    ).toThrow("Certificate email E2E sink is unavailable.");
    expect(() => getE2eCertificateEmailDeliveries()).toThrow(
      "Certificate email E2E sink is unavailable."
    );
  });

  it("stores only the minimized certificate delivery contract", () => {
    setStrictE2eEnvironment();
    resetE2eCertificateEmailDeliveries();

    recordE2eCertificateEmailDelivery({
      certificateCode: "CERT-001",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      recipient: "student@example.com",
      studentName: "Student Name",
      renderedHtml: "<p>secret</p>",
      token: "secret-token",
    } as Parameters<typeof recordE2eCertificateEmailDelivery>[0] & {
      certificateCode: string;
      renderedHtml: string;
      studentName: string;
      token: string;
    });

    const deliveries = getE2eCertificateEmailDeliveries();
    expect(deliveries).toEqual([
      {
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        recipientKey:
          "sha256:616bb35d31d0a6840d2d5adfeacde5979ea99a18ab5fa7bb633460029e20717e",
        topic: "email.certificate-issued",
      },
    ]);
    const serializedDeliveries = JSON.stringify(deliveries);
    for (const forbiddenValue of [
      "student@example.com",
      "CERT-001",
      "Student Name",
      "<p>secret</p>",
      "secret-token",
    ]) {
      expect(serializedDeliveries).not.toContain(forbiddenValue);
    }
  });

  it("shares the Symbol registry across separately evaluated modules", async () => {
    setStrictE2eEnvironment();
    resetE2eCertificateEmailDeliveries();
    recordE2eCertificateEmailDelivery({
      idempotencyKey: "email.certificate-issued/certificate-2/v1",
      recipient: "fixture-student@example.com",
    });

    vi.resetModules();
    const separatelyEvaluatedSink = await import("./e2e-delivery-sink");

    expect(separatelyEvaluatedSink.getE2eCertificateEmailDeliveries()).toEqual([
      expect.objectContaining({
        idempotencyKey: "email.certificate-issued/certificate-2/v1",
      }),
    ]);
  });

  it("normalizes recipient addresses before deriving the fixture key", () => {
    setStrictE2eEnvironment();
    resetE2eCertificateEmailDeliveries();

    for (const recipient of ["student@example.com", " STUDENT@EXAMPLE.COM "]) {
      recordE2eCertificateEmailDelivery({
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        recipient,
      });
    }

    const [firstDelivery, secondDelivery] = getE2eCertificateEmailDeliveries();
    expect(firstDelivery?.recipientKey).toBe(secondDelivery?.recipientKey);
  });
});
