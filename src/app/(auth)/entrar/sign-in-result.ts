export const isSuccessfulSignInPayload = (payload: unknown): boolean => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const data = payload as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    user?: unknown;
  };

  if (data.code || data.error) {
    return false;
  }

  return typeof data.user === "object" && data.user !== null;
};
