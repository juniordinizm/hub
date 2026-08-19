import type { AppRole } from "@/lib/session";

export type AuthPermission =
  | "executeRefund"
  | "manageCertificates"
  | "manageContent"
  | "manageEnrollmentAccess"
  | "manageFinancialOperations"
  | "manageFinancialReviews"
  | "manageLearningAnalytics"
  | "manageSettings"
  | "retryOutbox"
  | "retryWebhook"
  | "viewAdminPanel"
  | "viewFinancials";

const rolePermissions: Record<AppRole, AuthPermission[]> = {
  admin: [
    "executeRefund",
    "manageCertificates",
    "manageContent",
    "manageEnrollmentAccess",
    "manageFinancialOperations",
    "manageFinancialReviews",
    "manageLearningAnalytics",
    "manageSettings",
    "retryOutbox",
    "retryWebhook",
    "viewAdminPanel",
    "viewFinancials",
  ],
  student: [],
  support: [
    "executeRefund",
    "manageCertificates",
    "manageEnrollmentAccess",
    "viewAdminPanel",
    "viewFinancials",
  ],
};

export const canPerform = (
  role: AppRole,
  permission: AuthPermission
): boolean => rolePermissions[role].includes(permission);

export const rolesForPermission = (permission: AuthPermission): AppRole[] =>
  (Object.keys(rolePermissions) as AppRole[]).filter((role) =>
    canPerform(role, permission)
  );

export const isBlockedAuthEndpoint = ({
  allowPublicSignUp,
  method,
  pathSegments,
}: {
  allowPublicSignUp: boolean;
  method: string;
  pathSegments: string[];
}): boolean =>
  !allowPublicSignUp &&
  method.toUpperCase() === "POST" &&
  pathSegments.join("/") === "sign-up/email";

export const getBootstrapAdminDecision = ({
  authorization,
  nodeEnv,
  secret,
}: {
  authorization: string | null;
  nodeEnv: "development" | "production" | "test";
  secret: string | undefined;
}):
  | { allowed: true }
  | { allowed: false; error: string; status: 401 | 404 | 503 } => {
  if (nodeEnv === "production") {
    return { allowed: false, error: "not_found", status: 404 };
  }

  if (!secret) {
    return {
      allowed: false,
      error: "bootstrap_secret_not_configured",
      status: 503,
    };
  }

  if (authorization !== `Bearer ${secret}`) {
    return { allowed: false, error: "unauthorized", status: 401 };
  }

  return { allowed: true };
};

export const getPasswordResetRedirectUrl = ({
  appUrl,
  fallbackOrigin,
}: {
  appUrl: string | undefined;
  fallbackOrigin: string;
}): string => {
  const getOrigin = (url: string): string | null => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  };

  const origin =
    (appUrl ? getOrigin(appUrl) : null) ?? getOrigin(fallbackOrigin);

  if (!origin) {
    throw new Error("A valid password reset redirect origin is required.");
  }

  return new URL("/redefinir-senha", origin).toString();
};

export interface BetterAuthInfraConfig {
  apiKey: string;
  apiUrl?: string;
  kvUrl?: string;
}

const E2E_SIGN_IN_RATE_LIMIT = {
  max: 20,
  window: 10,
} as const;

export const getBetterAuthRateLimitConfig = (
  isE2eTestMode: boolean
):
  | { customRules: { "/sign-in/email": typeof E2E_SIGN_IN_RATE_LIMIT } }
  | undefined =>
  isE2eTestMode
    ? { customRules: { "/sign-in/email": E2E_SIGN_IN_RATE_LIMIT } }
    : undefined;

export const getResolvedBetterAuthInfraConfig = ({
  apiKey,
  apiUrl,
  isE2eTestMode,
  kvUrl,
}: {
  apiKey: string | undefined;
  apiUrl: string | undefined;
  isE2eTestMode?: boolean;
  kvUrl: string | undefined;
}): BetterAuthInfraConfig | null => {
  if (!apiKey || isE2eTestMode) {
    return null;
  }

  return {
    apiKey,
    ...(apiUrl ? { apiUrl } : {}),
    ...(kvUrl ? { kvUrl } : {}),
  };
};
