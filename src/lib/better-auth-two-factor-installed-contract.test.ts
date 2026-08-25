import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const DELETE_PRE_CHALLENGE_SESSION_PATTERN =
  /deleteSession\(data\.session\.token\)/;
const CREATE_VERIFIED_SESSION_PATTERN =
  /createSession\(user\.id, false, activeSession\)/;
const ACCOUNT_LOCK_PATTERN =
  /failedVerificationCount \?\? 0\) >= maxFailedAttempts/;
const TRUST_DEVICE_EXPIRY_PATTERN = /Date\.now\(\) \+ maxAge \* 1e3/;

describe("installed Better Auth 1.6.25 two-factor behavior", () => {
  it("deletes the password session before challenge and creates a session only after verification", async () => {
    const [packageJson, pluginSource, totpSource] = await Promise.all([
      readFile(
        new URL("../../node_modules/better-auth/package.json", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL(
          "../../node_modules/better-auth/dist/plugins/two-factor/index.mjs",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../../node_modules/better-auth/dist/plugins/two-factor/totp/index.mjs",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

    expect(JSON.parse(packageJson)).toMatchObject({ version: "1.6.25" });
    expect(pluginSource).toMatch(DELETE_PRE_CHALLENGE_SESSION_PATTERN);
    expect(totpSource).toMatch(CREATE_VERIFIED_SESSION_PATTERN);
  });

  it("applies the configured account lockout budget and trusted-device lifetime", async () => {
    const source = await readFile(
      new URL(
        "../../node_modules/better-auth/dist/plugins/two-factor/verify-two-factor.mjs",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toMatch(ACCOUNT_LOCK_PATTERN);
    expect(source).toMatch(TRUST_DEVICE_EXPIRY_PATTERN);
  });
});
