import { describe, expect, it } from "vitest";
import { assertDevelopmentEmailRecipientAllowed } from "./development-recipient";

describe("Development email recipient boundary", () => {
  it("accepts an allowlisted recipient case-insensitively", () => {
    expect(() =>
      assertDevelopmentEmailRecipientAllowed({
        allowlist: "dev-one@example.com, DEV-TWO@example.com",
        environment: "development",
        recipient: "dev-two@example.com",
      })
    ).not.toThrow();
  });

  it("rejects Development delivery without an allowlist", () => {
    expect(() =>
      assertDevelopmentEmailRecipientAllowed({
        allowlist: undefined,
        environment: "development",
        recipient: "student@example.com",
      })
    ).toThrow(
      "DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST is required to send email in Development."
    );
  });

  it("rejects a recipient outside the Development allowlist without echoing it", () => {
    const unsafeRecipient = "external-customer@example.com";

    expect(() =>
      assertDevelopmentEmailRecipientAllowed({
        allowlist: "dev@example.com",
        environment: "development",
        recipient: unsafeRecipient,
      })
    ).toThrow("Email recipient is not allowlisted for Development.");

    try {
      assertDevelopmentEmailRecipientAllowed({
        allowlist: "dev@example.com",
        environment: "development",
        recipient: unsafeRecipient,
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(unsafeRecipient);
    }
  });

  it("does not change Production delivery", () => {
    expect(() =>
      assertDevelopmentEmailRecipientAllowed({
        allowlist: undefined,
        environment: "production",
        recipient: "student@example.com",
      })
    ).not.toThrow();
  });
});
