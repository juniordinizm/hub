interface PublicAppEnvironment {
  NEXT_PUBLIC_APP_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}

const TRAILING_SLASH_PATTERN = /\/$/;

export const getPublicAppUrl = (environment: PublicAppEnvironment): string => {
  const configuredUrl = environment.NEXT_PUBLIC_APP_URL?.trim();

  if (!configuredUrl) {
    if (environment.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
    }

    return "http://localhost:3000";
  }

  return new URL(configuredUrl).toString().replace(TRAILING_SLASH_PATTERN, "");
};
