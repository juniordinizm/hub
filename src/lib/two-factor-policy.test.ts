import { describe, expect, it } from "vitest";
import {
  createTotpVerificationInput,
  TWO_FACTOR_CLIENT_PAGE,
  TWO_FACTOR_SERVER_OPTIONS,
} from "./two-factor-policy";

describe("privileged two-factor policy", () => {
  it("uses the approved issuer, lockout and zero trusted-device lifetime", () => {
    expect(TWO_FACTOR_SERVER_OPTIONS).toEqual({
      accountLockout: {
        durationSeconds: 900,
        enabled: true,
        maxFailedAttempts: 5,
      },
      issuer: "PROTEA-R Hub",
      trustDeviceMaxAge: 0,
    });
    expect(TWO_FACTOR_CLIENT_PAGE).toBe("/verificar-segundo-fator");
  });

  it("never asks Better Auth to trust a privileged device", () => {
    expect(createTotpVerificationInput("123456")).toEqual({
      code: "123456",
      trustDevice: false,
    });
  });
});
