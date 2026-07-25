import { describe, expect, it } from "vitest";
import { isSuccessfulSignUpPayload } from "./sign-up-result";

describe("isSuccessfulSignUpPayload", () => {
  it("rejects Better Auth error payloads", () => {
    expect(
      isSuccessfulSignUpPayload({
        code: "USER_ALREADY_EXISTS",
        message: "User already exists",
      })
    ).toBe(false);
  });

  it("rejects non-object responses", () => {
    expect(isSuccessfulSignUpPayload("<html>warning</html>")).toBe(false);
  });

  it("accepts account payloads with user data", () => {
    expect(
      isSuccessfulSignUpPayload({
        user: { id: "user_123", email: "aluno@example.com" },
      })
    ).toBe(true);
  });
});
