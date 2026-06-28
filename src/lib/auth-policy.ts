import type { AppRole } from "@/lib/session";

export type AuthPermission =
  | "manageContent"
  | "manageEnrollmentAccess"
  | "manageSettings"
  | "viewAdminPanel"
  | "viewFinancials";

const rolePermissions: Record<AppRole, AuthPermission[]> = {
  admin: [
    "manageContent",
    "manageEnrollmentAccess",
    "manageSettings",
    "viewAdminPanel",
    "viewFinancials",
  ],
  student: [],
  support: ["manageEnrollmentAccess", "viewAdminPanel"],
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

export const getResolvedBetterAuthInfraConfig = ({
  apiKey,
  apiUrl,
  kvUrl,
}: {
  apiKey: string | undefined;
  apiUrl: string | undefined;
  kvUrl: string | undefined;
}): BetterAuthInfraConfig | null => {
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    ...(apiUrl ? { apiUrl } : {}),
    ...(kvUrl ? { kvUrl } : {}),
  };
};
