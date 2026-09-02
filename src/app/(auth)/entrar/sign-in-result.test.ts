import { describe, expect, it } from "vitest";
import { isSuccessfulSignInPayload } from "./sign-in-result";

describe("isSuccessfulSignInPayload", () => {
  it("rejects Better Auth error payloads even when HTTP status is 200", () => {
    expect(
      isSuccessfulSignInPayload({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      })
    ).toBe(false);
  });

  it("rejects non-object responses such as ngrok warning HTML", () => {
    expect(isSuccessfulSignInPayload("<html>warning</html>")).toBe(false);
  });

  it("accepts session payloads with user data", () => {
    expect(
      isSuccessfulSignInPayload({
        user: { id: "user_123", email: "aluno@example.com" },
      })
    ).toBe(true);
  });
});
