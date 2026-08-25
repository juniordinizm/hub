import type { TwoFactorOptions } from "better-auth/plugins/two-factor";

export const TWO_FACTOR_CLIENT_PAGE = "/verificar-segundo-fator";

export const TWO_FACTOR_SERVER_OPTIONS = {
  accountLockout: {
    durationSeconds: 900,
    enabled: true,
    maxFailedAttempts: 5,
  },
  issuer: "PROTEA-R Hub",
  trustDeviceMaxAge: 0,
} as const satisfies TwoFactorOptions;

export const createTotpVerificationInput = (
  code: string
): { code: string; trustDevice: false } => ({
  code,
  trustDevice: false,
});
