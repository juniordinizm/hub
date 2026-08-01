export type RuntimeEnvironment =
  | "development"
  | "e2e"
  | "preview"
  | "production"
  | "staging";

type Environment = Readonly<Record<string, string | undefined>>;

export const resolveRuntimeEnvironment = (
  environment: Environment
): RuntimeEnvironment => {
  if (
    environment.E2E_TEST_MODE?.trim() === "true" &&
    environment.CI?.trim() === "true"
  ) {
    return "e2e";
  }

  if (environment.VERCEL_TARGET_ENV?.trim() === "staging") {
    return "staging";
  }

  if (
    environment.NODE_ENV === "production" &&
    environment.VERCEL_ENV === "preview"
  ) {
    return "preview";
  }

  return environment.NODE_ENV === "production" ? "production" : "development";
};
