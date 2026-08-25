import { describe, expect, it } from "vitest";
import {
  AUTH_PASSWORD_POLICY,
  getNewPasswordValidationError,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from "./password-policy";

describe("password policy", () => {
  it("rejects seven characters and accepts eight", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(
      getNewPasswordValidationError({
        confirmation: "1234567",
        password: "1234567",
      })
    ).toBe(PASSWORD_MIN_LENGTH_MESSAGE);
    expect(
      getNewPasswordValidationError({
        confirmation: "12345678",
        password: "12345678",
      })
    ).toBeNull();
  });

  it("rejects a divergent confirmation", () => {
    expect(
      getNewPasswordValidationError({
        confirmation: "abcdefgh",
        password: "12345678",
      })
    ).toBe("As senhas precisam ser iguais.");
  });

  it("keeps reset expiry and session revocation in the server policy", () => {
    expect(AUTH_PASSWORD_POLICY).toEqual({
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
    });
  });
});
