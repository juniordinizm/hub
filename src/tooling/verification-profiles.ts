export type VerificationGate =
  | "build"
  | "check"
  | "db:migrations:check"
  | "docs:check"
  | "knip"
  | "test"
  | "typecheck";

export type VerificationProfile = "full" | "quick";

export type VerificationExecutor = (gate: VerificationGate) => number;

const QUICK_GATES = [
  "db:migrations:check",
  "typecheck",
  "check",
  "test",
] as const satisfies readonly VerificationGate[];

const FULL_GATES = [
  "docs:check",
  ...QUICK_GATES,
  "build",
  "knip",
] as const satisfies readonly VerificationGate[];

const VERIFICATION_PROFILES: Readonly<
  Record<VerificationProfile, readonly VerificationGate[]>
> = {
  full: FULL_GATES,
  quick: QUICK_GATES,
};

const SYNTHETIC_BUILD_ORIGIN = "https://verification-build.invalid";

export const getVerificationEnvironmentOverrides = (
  gate: VerificationGate
): Readonly<Record<string, string>> => {
  if (gate !== "build") {
    return {};
  }

  return {
    BETTER_AUTH_SECRET: "verification-build-secret-not-for-deployment",
    BETTER_AUTH_URL: SYNTHETIC_BUILD_ORIGIN,
    CERTIFICATE_PUBLIC_BASE_URL: SYNTHETIC_BUILD_ORIGIN,
    NEXT_PUBLIC_APP_URL: SYNTHETIC_BUILD_ORIGIN,
  };
};

export const runVerificationProfile = (
  profile: VerificationProfile,
  executor: VerificationExecutor
): number => {
  for (const gate of VERIFICATION_PROFILES[profile]) {
    const status = executor(gate);
    if (status !== 0) {
      return status;
    }
  }

  return 0;
};
