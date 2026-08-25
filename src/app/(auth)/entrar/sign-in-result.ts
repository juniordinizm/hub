export type SignInOutcome = "authenticated" | "failure" | "two_factor_required";

export const getSignInOutcome = (payload: unknown): SignInOutcome => {
  if (typeof payload !== "object" || payload === null) {
    return "failure";
  }

  const data = payload as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    twoFactorRedirect?: unknown;
    user?: unknown;
  };

  if (data.code || data.error) {
    return "failure";
  }

  if (data.twoFactorRedirect === true) {
    return "two_factor_required";
  }

  return typeof data.user === "object" && data.user !== null
    ? "authenticated"
    : "failure";
};

export const isSuccessfulSignInPayload = (payload: unknown): boolean =>
  getSignInOutcome(payload) === "authenticated";
