import { describe, expect, it } from "vitest";
import {
  type AuthPermission,
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

  const permissions = [
    "executeRefund",
    "manageCertificates",
    "manageContent",
    "manageEnrollmentAccess",
    "manageEnrollmentSupport",
    "manageFinancialOperations",
    "manageFinancialReviews",
    "manageLearningAnalytics",
    "manageSettings",
    "reissueCertificates",
    "retryOutbox",
    "retryWebhook",
    "viewAdminPanel",
    "viewCourseOperations",
    "viewFinancials",
    "viewGlobalAudit",
    "viewScopedAudit",
    "viewStudentOperations",
  ] as const;

  const supportPermissions = new Set<(typeof permissions)[number]>([
    "executeRefund",
    "manageEnrollmentSupport",
    "reissueCertificates",
    "viewAdminPanel",
    "viewCourseOperations",
    "viewFinancials",
    "viewScopedAudit",
    "viewStudentOperations",
  ]);

  const permissionCases = (["admin", "support", "student"] as const).flatMap(
    (role) =>
      permissions.map(
        (permission) =>
          [
            role,
            permission,
            role === "admin" ||
              (role === "support" && supportPermissions.has(permission)),
          ] as const
      )
  );

  it.each(
    permissionCases
  )("authorizes role %s for %s as %s", (role, permission, expected) => {
    expect(canPerform(role, permission as AuthPermission)).toBe(expected);
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

  it("raises sign-in and password reset limits in isolated E2E mode", () => {
    expect(getBetterAuthRateLimitConfig(false)).toBeUndefined();
    expect(getBetterAuthRateLimitConfig(true)).toEqual({
      customRules: {
        "/request-password-reset": { max: 100, window: 10 },
        "/sign-in/email": { max: 100, window: 10 },
      },
    });
  });
});
