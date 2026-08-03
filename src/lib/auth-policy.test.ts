import { describe, expect, it } from "vitest";
import {
  canPerform,
  getBetterAuthRateLimitConfig,
  getBootstrapAdminDecision,
  getPasswordResetRedirectUrl,
  getResolvedBetterAuthInfraConfig,
  isBlockedAuthEndpoint,
} from "./auth-policy";

describe("auth policy", () => {
  it("blocks public email sign-up by default", () => {
    expect(
      isBlockedAuthEndpoint({
        allowPublicSignUp: false,
        method: "POST",
        pathSegments: ["sign-up", "email"],
      })
    ).toBe(true);
  });

  it("allows Better Auth internal sign-up when explicitly enabled", () => {
    expect(
      isBlockedAuthEndpoint({
        allowPublicSignUp: true,
        method: "POST",
        pathSegments: ["sign-up", "email"],
      })
    ).toBe(false);
  });

  it("requires a bootstrap secret outside production too", () => {
    expect(
      getBootstrapAdminDecision({
        authorization: null,
        nodeEnv: "development",
        secret: undefined,
      })
    ).toEqual({
      allowed: false,
      error: "bootstrap_secret_not_configured",
      status: 503,
    });
  });

  it("accepts bootstrap only with the configured bearer token", () => {
    expect(
      getBootstrapAdminDecision({
        authorization: "Bearer local-secret",
        nodeEnv: "development",
        secret: "local-secret",
      })
    ).toEqual({ allowed: true });
  });

  it("uses the canonical app url for password reset redirects", () => {
    expect(
      getPasswordResetRedirectUrl({
        appUrl: "https://hub.example.com/app",
        fallbackOrigin: "https://attacker.example.com",
      })
    ).toBe("https://hub.example.com/redefinir-senha");
  });

  it("falls back to the current origin when the canonical app url is invalid", () => {
    expect(
      getPasswordResetRedirectUrl({
        appUrl: "invalid-url",
        fallbackOrigin: "https://preview.example.com/app",
      })
    ).toBe("https://preview.example.com/redefinir-senha");
  });

  it("keeps admin and support permissions explicit", () => {
    expect(canPerform("admin", "manageContent")).toBe(true);
    expect(canPerform("support", "manageContent")).toBe(false);
    expect(canPerform("support", "manageEnrollmentAccess")).toBe(true);
    expect(canPerform("support", "manageCertificates")).toBe(true);
    expect(canPerform("support", "executeRefund")).toBe(true);
    expect(canPerform("support", "retryWebhook")).toBe(false);
    expect(canPerform("admin", "retryWebhook")).toBe(true);
    expect(canPerform("support", "retryOutbox")).toBe(false);
    expect(canPerform("admin", "retryOutbox")).toBe(true);
    expect(canPerform("support", "manageFinancialOperations")).toBe(false);
    expect(canPerform("admin", "manageFinancialOperations")).toBe(true);
    expect(canPerform("support", "manageFinancialReviews")).toBe(false);
    expect(canPerform("admin", "manageFinancialReviews")).toBe(true);
    expect(canPerform("student", "viewAdminPanel")).toBe(false);
  });

  it("enables Better Auth infra only when an api key is configured", () => {
    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: undefined,
        apiUrl: undefined,
        kvUrl: undefined,
      })
    ).toBeNull();

    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: "dash-key",
        apiUrl: "https://api.example.com",
        kvUrl: "https://kv.example.com",
      })
    ).toEqual({
      apiKey: "dash-key",
      apiUrl: "https://api.example.com",
      kvUrl: "https://kv.example.com",
    });
  });

  it("disables Better Auth infra for isolated E2E fixtures", () => {
    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: "dash-key",
        apiUrl: "https://api.example.com",
        isE2eTestMode: true,
        kvUrl: "https://kv.example.com",
      })
    ).toBeNull();
  });

  it("only raises the sign-in limit in isolated E2E mode", () => {
    expect(getBetterAuthRateLimitConfig(false)).toBeUndefined();
    expect(getBetterAuthRateLimitConfig(true)).toEqual({
      customRules: {
        "/sign-in/email": { max: 20, window: 10 },
      },
    });
  });
});
