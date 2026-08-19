import { describe, expect, it } from "vitest";
import {
  assertDevelopmentEmailRecipientAllowed,
  assertDevelopmentOrStagingEmailRecipientAllowed,
} from "./development-recipient";

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

    const thrownError = (() => {
      try {
        assertDevelopmentEmailRecipientAllowed({
          allowlist: "dev@example.com",
          environment: "development",
          recipient: unsafeRecipient,
        });
      } catch (error) {
        return error;
      }
      return;
    })();

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      "Email recipient is not allowlisted for Development."
    );
    expect((thrownError as Error).message).not.toContain(unsafeRecipient);
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

  it("preserves the legacy wrapper behavior for Staging", () => {
    expect(() =>
      assertDevelopmentEmailRecipientAllowed({
        allowlist: undefined,
        environment: "staging",
        recipient: "student@example.com",
      })
    ).not.toThrow();
  });

  it("accepts an allowlisted Staging recipient after trimming and normalizing", () => {
    expect(() =>
      assertDevelopmentOrStagingEmailRecipientAllowed({
        allowlist: " staging-one@example.com, STAGING-TWO@example.com ",
        environment: "staging",
        recipient: " staging-two@example.com ",
      })
    ).not.toThrow();
  });

  it("rejects Staging delivery without an allowlist", () => {
    expect(() =>
      assertDevelopmentOrStagingEmailRecipientAllowed({
        allowlist: undefined,
        environment: "staging",
        recipient: "student@example.com",
      })
    ).toThrow(
      "STAGING_EMAIL_RECIPIENT_ALLOWLIST is required to send email in Staging."
    );
  });

  it("rejects a recipient outside the Staging allowlist without echoing it", () => {
    const unsafeRecipient = "external-staging-customer@example.com";

    const thrownError = (() => {
      try {
        assertDevelopmentOrStagingEmailRecipientAllowed({
          allowlist: "staging@example.com",
          environment: "staging",
          recipient: unsafeRecipient,
        });
      } catch (error) {
        return error;
      }
      return;
    })();

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      "Email recipient is not allowlisted for Staging."
    );
    expect((thrownError as Error).message).not.toContain(unsafeRecipient);
  });

  it.each([
    "production",
    "preview",
    "e2e",
    "unknown",
  ])("does not apply the allowlist to %s", (environment) => {
    expect(() =>
      assertDevelopmentOrStagingEmailRecipientAllowed({
        allowlist: undefined,
        environment,
        recipient: "student@example.com",
      })
    ).not.toThrow();
  });
});
