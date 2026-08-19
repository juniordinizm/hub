import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  recordE2eCertificateEmailDelivery,
  resetE2eCertificateEmailDeliveries,
} from "@/features/email/e2e-delivery-sink";
import { GET } from "./route";

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

describe("GET /api/e2e/email-deliveries", () => {
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
  ])("returns 404 when %s is outside the strict E2E contract", async (key, value) => {
    setStrictE2eEnvironment();
    process.env[key] = value;

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("returns only minimized certificate deliveries in strict E2E mode", async () => {
    setStrictE2eEnvironment();
    resetE2eCertificateEmailDeliveries();
    recordE2eCertificateEmailDelivery({
      arbitraryPayload: { secret: true },
      certificateCode: "CERT-001",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      recipient: "student@example.com",
      renderedHtml: "<p>secret</p>",
      studentName: "Student Name",
      token: "secret-token",
    } as Parameters<typeof recordE2eCertificateEmailDelivery>[0] & {
      arbitraryPayload: { secret: boolean };
      certificateCode: string;
      renderedHtml: string;
      studentName: string;
      token: string;
    });

    const response = await GET();
    const serializedResponse = await response.clone().text();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deliveries: [
        {
          idempotencyKey: "email.certificate-issued/certificate-1/v1",
          recipientKey:
            "sha256:616bb35d31d0a6840d2d5adfeacde5979ea99a18ab5fa7bb633460029e20717e",
          topic: "email.certificate-issued",
        },
      ],
    });
    for (const forbiddenValue of [
      "student@example.com",
      "CERT-001",
      "Student Name",
      "<p>secret</p>",
      "secret-token",
      "secret",
    ]) {
      expect(serializedResponse).not.toContain(forbiddenValue);
    }
  });
});
